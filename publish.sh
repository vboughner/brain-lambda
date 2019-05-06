rm index.zip 
cd src
zip ../index.zip *
cd .. 
aws lambda update-function-code --function-name myHelloWorld --zip-file fileb://index.zip
