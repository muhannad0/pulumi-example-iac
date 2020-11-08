#!/bin/bash
# Checks the response code every 2 seconds.
# Usage:
# sh check-http-reponse.sh <url>
# Ctrl+C to exit

while true; do
    curl -sL -w "%{response_code}\n" -I "$1" -o /dev/null
    sleep 2
done