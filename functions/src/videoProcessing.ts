import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb as db } from './firebaseAdmin';
import { TranscoderServiceClient } from '@google-cloud/video-transcoder';
import { Storage } from '@google-cloud/storage';

const transcoder = new TranscoderServiceClient();
const storage = new Storage();
const REGION = 'africa-south1';

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
}

export const processUploadedVideo = onObjectFinalized({ region: REGION, retry: true }, async (event) => {
  const object = event.data;
  const bucket = object.bucket;
  const name = object.name ?? '';
  const contentType = object.contentType ?? '';
  if (!name.startsWith('video-input/') || !contentType.startsWith('video/')) return;

  const parts = name.split('/');
  if (parts.length < 4) return;
  const uid = parts[1];
  const videoId = parts[2];
  const sourcePath = parts.slice(3).join('/');
  const docRef = db.collection('videos').doc(videoId);

  await docRef.set({ uid, status: 'processing', sourcePath: name, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  const projectId = process.env.GCLOUD_PROJECT;
  if (!projectId) throw new Error('GCLOUD_PROJECT is unavailable.');

  const outputPrefix = `video-processed/${safeSegment(uid)}/${safeSegment(videoId)}/`;
  const transcoderLocation = process.env.TRANSCODER_LOCATION || 'europe-west1';
  const parent = transcoder.locationPath(projectId, transcoderLocation);
  const job = {
    inputUri: `gs://${bucket}/${name}`,
    outputUri: `gs://${bucket}/${outputPrefix}`,
    config: {
      elementaryStreams: [
        { key: 'video-stream', videoStream: { h264: { heightPixels: 720, widthPixels: 1280, bitrateBps: 2500000, frameRate: 30, pixelFormat: 'yuv420p' } } },
        { key: 'audio-stream', audioStream: { codec: 'aac', bitrateBps: 128000, channelCount: 2, channelLayout: ['fl', 'fr'] } },
      ],
      muxStreams: [{ key: 'mp4', container: 'mp4', elementaryStreams: ['video-stream', 'audio-stream'], fileName: 'main.mp4' }],
      spriteSheets: [{ filePrefix: 'thumb', spriteHeightPixels: 180, spriteWidthPixels: 320, columnCount: 1, rowCount: 1, interval: { seconds: 1 } }],
    },
  };

  const [created] = await transcoder.createJob({ parent, job });
  await docRef.set({ transcoderJob: created.name, status: 'transcoding', outputPrefix, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  await storage.bucket(bucket).file(name).setMetadata({ metadata: { processing: 'submitted', videoId } });
});
