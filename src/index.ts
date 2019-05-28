import { IVersion, processImages } from '@jovinbm/process-images';
import * as aws from 'aws-sdk';
import fs from 'fs';
import mkdirp from 'mkdirp';
import path from 'path';
import uuidV4 from 'uuid/v4';

const S3 = new aws.S3();

export interface ILambdaProcessImagesEvent {
  bucket: string;
  key: string;
  // output key = path.join(output_directory, each processed file name)
  output_bucket: string;
  output_directory: string;
  put_object_options: Partial<aws.S3.Types.PutObjectRequest>;
  versions: IVersion[];
}

export interface ILambdaProcessImagesSuccessPayload {
  error_message?: string;
  data?: {
    // e.g. 80: 'images/140619_5872_aspR_1.5_w4898_h3265_e80.jpg'
    [key: string]: string;
  };
}

export type TLambdaSuccessFunction = (
  payload: ILambdaProcessImagesSuccessPayload
) => any;

export const handler = async (
  event: ILambdaProcessImagesEvent,
  context: {
    succeed: TLambdaSuccessFunction;
  }
) => {
  try {
    const folder_input = `/tmp/images/input/${uuidV4()}`;
    const folder_output = `/tmp/images/output/${uuidV4()}`;

    console.log('Creating input and output folders.');
    await Promise.all(
      [folder_input, folder_output].map(p => {
        return new Promise((resolve, reject) => {
          mkdirp(p, err => {
            if (err) {
              reject(err);
            } else {
              resolve(true);
            }
          });
        });
      })
    );

    console.log(`Getting bucket=${event.bucket}, key=${event.key} from s3.`);
    const file: Buffer = await new Promise<Buffer>((resolve, reject) => {
      S3.getObject(
        {
          Bucket: event.bucket,
          Key: event.key,
        },
        (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data.Body as Buffer);
          }
        }
      );
    });

    console.log(`Writing file to input folder.`);
    await new Promise((resolve, reject) => {
      fs.writeFile(
        path.join(folder_input, path.basename(event.key)),
        file,
        error => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        }
      );
    });

    console.log('Processing files.');
    const processing_results = (await processImages({
      absolute_directory_path: folder_input,
      absolute_output_directory_path: folder_output,
      versions: event.versions,
    }))[path.basename(event.key)];

    // processImages only returns the new file names. We want this result to contain
    // the full key of where the image lives in s3
    Object.keys(processing_results).map(version_height => {
      processing_results[version_height] = path.join(
        event.output_directory,
        processing_results[version_height]
      );
    });

    console.log('Uploading processed files back to S3.');
    const uploadPromises: Promise<any>[] = [];
    await new Promise((resolve, reject) => {
      fs.readdir(folder_output, (err, file_names) => {
        if (err) {
          reject(err);
        } else {
          file_names.map(file_name => {
            uploadPromises.push(
              new Promise((resolve, reject) => {
                S3.putObject(
                  {
                    ...event.put_object_options,
                    Bucket: event.output_bucket,
                    Key: path.join(event.output_directory, file_name),
                    Body: fs.createReadStream(
                      path.join(folder_output, file_name)
                    ),
                  },
                  err => {
                    if (err) {
                      reject(err);
                    } else {
                      resolve();
                    }
                  }
                );
              })
            );
          });
          resolve();
        }
      });
    });
    await Promise.all(uploadPromises);

    console.log('Done!');
    context.succeed({
      data: processing_results,
    });
  } catch (err) {
    console.error(err);
    context.succeed({
      error_message: err.message,
    });
  }
};
