echo 'preparing a layer zip file for upload...'
rm -f nodejs.zip
rm -rf nodejs
mkdir nodejs
cp src/package.json src/yarn.lock nodejs
cd nodejs
yarn install
cd ..
zip -q -r nodejs.zip nodejs
echo 'zip file ready at nodejs.zip for upload to layer'
