#!/bin/bash
echo "<html><h1>Hello, World</h1> -- from $(hostname)!</html>" > index.html
nohup python -m SimpleHTTPServer 3000 &