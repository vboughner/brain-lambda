echo 'zipping up src/*.js files...'
rm -f index.zip
cd src
zip -q -r ../index.zip *.js
cd ..
echo 'updating lambda...'
aws lambda update-function-code --function-name brain-lambda --zip-file fileb://index.zip
