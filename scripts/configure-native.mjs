import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

// 1. PATCH ANDROID MANIFEST (Camera, ML Kit Barcode Model, UPI & WhatsApp Intent Queries)
const androidManifestPath = path.join(
  rootDir,
  'android',
  'app',
  'src',
  'main',
  'AndroidManifest.xml'
);

if (fs.existsSync(androidManifestPath)) {
  let manifest = fs.readFileSync(androidManifestPath, 'utf8');

  // Inject Camera Permission if missing
  if (!manifest.includes('android.permission.CAMERA')) {
    manifest = manifest.replace(
      '</manifest>',
      '    <uses-permission android:name="android.permission.CAMERA" />\n</manifest>'
    );
  }

  // Inject Google ML Kit Barcode dependency metadata inside <application>
  if (!manifest.includes('com.google.mlkit.vision.DEPENDENCIES')) {
    manifest = manifest.replace(
      '</application>',
      '        <meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="barcode" />\n    </application>'
    );
  }

  // Inject Android 11+ <queries> for UPI & WhatsApp deep links
  if (!manifest.includes('android:scheme="upi"')) {
    const queriesBlock = `    <queries>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="upi" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="whatsapp" />
        </intent>
    </queries>\n</manifest>`;
    manifest = manifest.replace('</manifest>', queriesBlock);
  }

  fs.writeFileSync(androidManifestPath, manifest, 'utf8');
  console.log('[Ekwly Native] Patched AndroidManifest.xml (Camera, ML Kit, UPI & WhatsApp).');
}

// 2. PATCH iOS INFO.PLIST (Camera, Photo Library & UPI/WhatsApp URL Schemes)
const iosPlistPath = path.join(rootDir, 'ios', 'App', 'App', 'Info.plist');

if (fs.existsSync(iosPlistPath)) {
  let plist = fs.readFileSync(iosPlistPath, 'utf8');

  if (!plist.includes('NSCameraUsageDescription')) {
    const iosAdditions = `	<key>NSCameraUsageDescription</key>
	<string>Ekwly needs camera access to scan restaurant receipts and room QR codes.</string>
	<key>NSPhotoLibraryUsageDescription</key>
	<string>Ekwly needs photo library access so you can upload receipt images for Magic Scan.</string>
	<key>NSPhotoLibraryAddUsageDescription</key>
	<string>Ekwly needs permission to save settlement receipts.</string>
	<key>LSApplicationQueriesSchemes</key>
	<array>
		<string>upi</string>
		<string>gpay</string>
		<string>phonepe</string>
		<string>paytmmp</string>
		<string>whatsapp</string>
	</array>\n</dict>`;
    plist = plist.replace(/<\/dict>\s*<\/plist>/, `${iosAdditions}\n</plist>`);
    fs.writeFileSync(iosPlistPath, plist, 'utf8');
    console.log('[Ekwly Native] Patched iOS Info.plist (Camera, Photo Library, UPI Schemes).');
  }
}
