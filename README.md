# Pulumi Example

Deploying a Application Load Balancer (ALB) with an Auto Scaling Group (ASG) on [AWS](https://aws.amazon.com/) using [Pulumi](https://pulumi.com/).

## Requirements
Follow the instructions from [Get Started](https://www.pulumi.com/docs/get-started/aws/begin/)
+ Pulumi CLI
+ NodeJS
+ AWS Credentials

## Configure
+ Install the required packages
```
npm install
```

+ Create a new stack on Pulumi
```
pulumi stack init
```

## Deploy
Run `pulumi update` and select `yes` to deploy the stack.

## Destroy
Once done you can destroy and remove the stack.
```
pulumi destroy --yes
pulumi stack rm --yes
```