import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

// Config
const serverPort = 3000;

// Common Tags
const commonTags = {
    "Pulumi": "true",
    "env": "dev",
}

// VPC
const vpcDefault = awsx.ec2.Vpc.getDefault();

// ALB
const alb = new awsx.lb.ApplicationLoadBalancer("main-alb", {
    vpc: vpcDefault,
    tags: commonTags,
});

const httpListener = alb.createListener("web-listener", {
    port: 80,
    protocol: "HTTP",
    defaultAction: {
        type: "fixed-response",
        fixedResponse: {
            contentType: "text/plain",
            messageBody: "404: not found",
            statusCode: "404",
        },
    },
});

// SGs
const instanceSg = new awsx.ec2.SecurityGroup("instance-sg", {
    vpc: vpcDefault,
    tags: commonTags,
});

instanceSg.createIngressRule("allow-alb", {
    fromPort: serverPort,
    toPort: serverPort,
    protocol: "tcp",
    sourceSecurityGroupId: alb.securityGroups[0].id,
    description: "allow access to instance from alb",
});

instanceSg.createEgressRule("outbound-access", {
    location: new awsx.ec2.AnyIPv4Location,
    ports: new awsx.ec2.AllTcpPorts,
    description: "allow all outbound from instance",
});

// ASG

// Outputs
export const vcpId = vpcDefault.id;
export const subnetIds = vpcDefault.publicSubnetIds;
export const albDns = httpListener.endpoint;
export const albSgId = alb.securityGroups[0].id;