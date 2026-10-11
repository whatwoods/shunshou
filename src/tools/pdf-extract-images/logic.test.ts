import { expect, it } from 'vitest';
import { PDFDocument, PDFName } from '@cantoo/pdf-lib';
import { imageObjects } from '../../lib/pdf/images';
it('finds shared images inside nested Forms only once and excludes orphan objects', async () => {
  const doc = await PDFDocument.create(),
    page = doc.addPage();
  const image = doc.context.flateStream(new Uint8Array([255, 0, 0]), {
    Type: 'XObject',
    Subtype: 'Image',
    Width: 1,
    Height: 1,
    BitsPerComponent: 8,
    ColorSpace: 'DeviceRGB'
  });
  const imageRef = doc.context.register(image);
  doc.context.register(doc.context.flateStream(new Uint8Array([0]), { Type: 'XObject', Subtype: 'Image' }));
  const form = doc.context.flateStream('/Pic Do', {
    Type: 'XObject',
    Subtype: 'Form',
    BBox: [0, 0, 1, 1],
    Resources: { XObject: { Pic: imageRef } }
  });
  const formRef = doc.context.register(form);
  page.node.setXObject(PDFName.of('Direct'), imageRef);
  page.node.setXObject(PDFName.of('Nested'), formRef);
  expect(imageObjects(doc).map((entry) => entry.ref.toString())).toEqual([imageRef.toString()]);
});
