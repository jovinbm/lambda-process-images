import { handler } from '../index';

async function doTest(): Promise<void> {
  return handler({
    bucket: 'african-exponent-assets',
    key: 'images/140619_5872.jpg',
    output_bucket: 'african-exponent-assets',
    output_directory: 'images',
    put_object_options: {},
    versions: [{ height: 80 }, { height: 200 }, { height: 400 }],
  }, {
    succeed: console.log,
  });
}

doTest()
  .then(console.log)
  .catch(console.error);
