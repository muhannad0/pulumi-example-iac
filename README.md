# Pulumi Example

Deploying an Application Load Balancer (ALB) with an Auto Scaling Group (ASG) on [AWS](https://aws.amazon.com/) using [Pulumi](https://pulumi.com/).

## Requirements
Follow the instructions on [Get Started](https://www.pulumi.com/docs/get-started/aws/begin/)
+ Pulumi CLI
+ NodeJS
+ AWS Credentials

## Configure
+ Install the required packages.
```
npm install
```

+ Create a new stack on Pulumi.
```
pulumi stack init
```

+ Set the deploy environment configuration.
```
pulumi config set web-config:env dev
```

+ You can modify other parameters as required. Refer to `Pulumi.yaml` to see which parameters are available for configuration.
```
pulumi config set web-config:serverText "Example Text"
```

## Deploy
Run `pulumi update` and select `yes` to deploy the stack.

## Destroy
To destroy and remove the stack:

```
pulumi destroy -y
pulumi stack rm -y
```