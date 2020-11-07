import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as fs from "fs";

// Get latest AMI for Amazon Linux 2
const ami = pulumi.output(aws.getAmi({
    filters: [
        {
            name: "name",
            values: ["amzn2-ami-hvm-2.0.*-x86_64-gp2"],
        },
        {
            name: "virtualization-type",
            values: ["hvm"],
        },
    ],
    owners: ["amazon"],
    mostRecent: true,
}));

// Config
const serverPort = 3000;
const webImageId = ami.id;
const webInstanceType = aws.ec2.InstanceType.T2_Micro
const webMinSize = 1
const webMaxSize = 3
const webDesiredCapacity = 1

// Common Tags
const commonTags = {
    "Pulumi": "true",
    "env": "dev",
}

// Common SG Rules
const allowAllOutboundSgConfig = {
    location: new awsx.ec2.AnyIPv4Location,
    ports: new awsx.ec2.AllTcpPorts,
    description: "allow all outbound",
}

// VPC
const vpcDefault = awsx.ec2.Vpc.getDefault();

// Security Group ALB
const albSg = new awsx.ec2.SecurityGroup("alb-sg", {
    vpc: vpcDefault,
    tags: commonTags,
})

albSg.createIngressRule("allow-http-inbound-alb", {
    location: new awsx.ec2.AnyIPv4Location,
    ports: new awsx.ec2.TcpPorts(80),
    description: "allow HTTP inbound to alb"
});

albSg.createEgressRule("allow-all-outbound-alb", allowAllOutboundSgConfig);

// ALB
const alb = new aws.alb.LoadBalancer("alb-main", {
    name: "alb-main",
    internal: false,
    loadBalancerType: "application",
    securityGroups: [albSg.id],
    subnets: vpcDefault.publicSubnetIds,
    tags: commonTags,
});

const webTarget = new aws.alb.TargetGroup("web-tg", {
    protocol: "HTTP",
    targetType: "instance",
    port: serverPort,
    healthCheck: {
        interval: 15,
    },
    deregistrationDelay: 30,
    vpcId: vpcDefault.id,
    tags: commonTags, 
});

const webListener = new aws.lb.Listener("alb-web-listener", {
    loadBalancerArn: alb.arn,
    port: 80,
    protocol: "HTTP",
    defaultActions: [{
        type: "forward",
        targetGroupArn: webTarget.arn,
    }],
});

// Security Group ASG Instance
const instanceSg = new awsx.ec2.SecurityGroup("instance-sg", {
    vpc: vpcDefault,
    tags: commonTags,
});

instanceSg.createIngressRule("allow-alb-inbound-instance", {
    fromPort: serverPort,
    toPort: serverPort,
    protocol: "tcp",
    sourceSecurityGroupId: albSg.id,
    description: "allow web service inbound to instance from alb",
});

instanceSg.createIngressRule("allow-all-inbound-instance", {
    location: new awsx.ec2.AnyIPv4Location,
    ports: new awsx.ec2.TcpPorts(3000),
    description: "allow all inbound to instance"
});

instanceSg.createEgressRule("allow-all-outbound-instance", allowAllOutboundSgConfig);

// ASG
const webLaunchConfig = new aws.ec2.LaunchConfiguration("web-lc", {
    imageId: webImageId,
    instanceType: webInstanceType,
    securityGroups: [instanceSg.id],
    userData: fs.readFileSync("user-data.sh").toString(),
});

const webAsg = new aws.autoscaling.Group("web-asg", {
    minSize: webMinSize,
    maxSize: webMaxSize,
    desiredCapacity: webDesiredCapacity,
    launchConfiguration: webLaunchConfig.name,
    vpcZoneIdentifiers: vpcDefault.publicSubnetIds,
    tags: [
        {
            key: "Pulumi",
            value: "true",
            propagateAtLaunch: true,
        },
        {
            key: "env",
            value: "dev",
            propagateAtLaunch: true,
        },
    ],
});

// Attach ASG to ALB Target Group
new aws.autoscaling.Attachment("web-asg-alb-attach", {
    albTargetGroupArn: webTarget.arn,
    autoscalingGroupName: webAsg.name,
});

// Outputs
export const webUrl = alb.dnsName;