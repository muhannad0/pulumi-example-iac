import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as fs from "fs";

// TODO: make it a function
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
const config = new pulumi.Config("web-config");

const env: string = config.require("env");
const serverText: string = config.get("serverText") || "Hello World";
const serverPort: number = config.getNumber("serverPort") || 3000;
const webInstanceType: string = config.get("instanceType") || "t2.micro";
const webMinSize: number = config.getNumber("minSize")|| 1;
const webMaxSize: number = config.getNumber("maxSize") || 1;
const webDesiredCapacity: number = config.getNumber("desiredSize") || webMinSize;
const webImageId = ami.id;

// Common Tags
const commonTags = {
    "Pulumi": "true",
    "env": env,
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
    port: serverPort,
    targetType: "instance",
    healthCheck: {
        path: "/",
        protocol: "HTTP",
        matcher: "200",
        timeout: 3,
        healthyThreshold: 2,
        unhealthyThreshold: 2,
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

// instanceSg.createIngressRule("allow-all-inbound-instance", {
//     location: new awsx.ec2.AnyIPv4Location,
//     ports: new awsx.ec2.TcpPorts(3000),
//     description: "allow all inbound to instance"
// });

instanceSg.createEgressRule("allow-all-outbound-instance", allowAllOutboundSgConfig);

// ASG
// TODO: figure out templating feature for userData script.
const webLaunchConfig = new aws.ec2.LaunchConfiguration("web-lc", {
    imageId: webImageId,
    instanceType: webInstanceType,
    securityGroups: [instanceSg.id],
    // userData: fs.readFileSync("user-data.sh").toString(),
    userData: "#!/bin/bash\n" +
        `echo "<html><h1>${serverText}</h1> -- from $(hostname)!</html>" > index.html\n` +
        `nohup python -m SimpleHTTPServer ${serverPort} &`,
});

const webAsg = new aws.autoscaling.Group("web-asg", {
    name: webLaunchConfig.name.apply(launchConfig => "asg-" + launchConfig),
    minSize: webMinSize,
    maxSize: webMaxSize,
    desiredCapacity: webDesiredCapacity,
    launchConfiguration: webLaunchConfig.name,
    minElbCapacity: webMinSize,
    targetGroupArns: [webTarget.arn],
    vpcZoneIdentifiers: vpcDefault.publicSubnetIds,
    tags: [
        {
            key: "Name",
            value: `web-${env}`,
            propagateAtLaunch: true,
        },
        {
            key: "Pulumi",
            value: "true",
            propagateAtLaunch: true,
        },
        {
            key: "env",
            value: env,
            propagateAtLaunch: true,
        },
    ],
}, {deleteBeforeReplace: false});

// Attach ASG to ALB Target Group
// new aws.autoscaling.Attachment("web-asg-alb-attach", {
//     albTargetGroupArn: webTarget.arn,
//     autoscalingGroupName: webAsg.name,
// });

// Outputs
export const webUrl = alb.dnsName.apply(url => "http://" + url);