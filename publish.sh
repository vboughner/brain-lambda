rm index.zip 
cd src
zip ../index.zip *
cd .. 
aws lambda update-function-code --function-name brain-lambda --zip-file fileb://index.zip
