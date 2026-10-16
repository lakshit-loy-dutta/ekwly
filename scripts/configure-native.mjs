import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const rootDir = process.cwd();
const isWindows = os.platform() === 'win32';
const mode = process.argv[2] || 'patch'; // 'patch' | 'apk-debug' | 'apk-release'

// --- 1. AUTO-DETECT ANDROID STUDIO JBR 21 & ANDROID SDK ON WINDOWS ---
function findJavaHome() {
  if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) {
    return process.env.JAVA_HOME;
  }
  if (isWindows) {
    const candidates = [
      'C:\\Program Files\\Android\\Android Studio\\jbr',
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Android Studio', 'jbr'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(path.join(c, 'bin', 'java.exe'))) return c;
    }
  }
  return null;
}

function findAndroidSdk() {
  if (process.env.ANDROID_HOME && fs.existsSync(process.env.ANDROID_HOME)) {
    return process.env.ANDROID_HOME;
  }
  if (isWindows) {
    const defaultSdk = path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
    if (fs.existsSync(defaultSdk)) return defaultSdk;
  }
  return null;
}

const javaHome = findJavaHome();
const androidSdk = findAndroidSdk();

// --- 2. PATCH ANDROID MANIFEST, LOCAL.PROPERTIES & GRADLE.PROPERTIES ---
const androidDir = path.join(rootDir, 'android');
const androidManifestPath = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');

if (fs.existsSync(androidDir)) {
  if (androidSdk) {
    const escapedSdk = androidSdk.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
    fs.writeFileSync(path.join(androidDir, 'local.properties'), `sdk.dir=${escapedSdk}\n`, 'utf8');
    console.log(`[Ekwly Native] Linked Android SDK -> ${androidSdk}`);
  }

  const gradlePropsPath = path.join(androidDir, 'gradle.properties');
  if (fs.existsSync(gradlePropsPath)) {
    let gradleProps = fs.readFileSync(gradlePropsPath, 'utf8');
    if (javaHome && !gradleProps.includes('org.gradle.java.home')) {
      const escapedJava = javaHome.replace(/\\/g, '/');
      gradleProps += `\n# Auto-configured by Ekwly configure-native.mjs\norg.gradle.java.home=${escapedJava}\norg.gradle.parallel=true\norg.gradle.caching=true\n`;
      fs.writeFileSync(gradlePropsPath, gradleProps, 'utf8');
      console.log(`[Ekwly Native] Linked Gradle JDK 21 -> ${javaHome}`);
    }
  }
}

if (fs.existsSync(androidManifestPath)) {
  let manifest = fs.readFileSync(androidManifestPath, 'utf8');

  if (!manifest.includes('android.permission.CAMERA')) {
    manifest = manifest.replace(
      '</manifest>',
      '    <uses-permission android:name="android.permission.CAMERA" />\n    <uses-permission android:name="android.permission.VIBRATE" />\n</manifest>'
    );
  }

  if (!manifest.includes('com.google.mlkit.vision.DEPENDENCIES')) {
    manifest = manifest.replace(
      '</application>',
      '        <meta-data android:name="com.google.mlkit.vision.DEPENDENCIES" android:value="barcode" />\n    </application>'
    );
  }

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
  console.log(
    '[Ekwly Native] Patched AndroidManifest.xml (Camera, Vibrate, ML Kit, UPI & WhatsApp).'
  );
}

// --- 3. PATCH iOS INFO.PLIST & XTOOL.YML ---
const iosPlistPath = path.join(rootDir, 'ios', 'App', 'App', 'Info.plist');

if (fs.existsSync(iosPlistPath)) {
  let plist = fs.readFileSync(iosPlistPath, 'utf8');

  if (!plist.includes('NSCameraUsageDescription')) {
    const iosAdditions = `\t<key>NSCameraUsageDescription</key>
\t<string>Ekwly needs camera access to scan restaurant receipts and room QR codes.</string>
\t<key>NSPhotoLibraryUsageDescription</key>
\t<string>Ekwly needs photo library access so you can upload receipt images for Magic Scan.</string>
\t<key>NSPhotoLibraryAddUsageDescription</key>
\t<string>Ekwly needs permission to save settlement receipts.</string>
\t<key>CADisableMinimumFrameDurationOnPhone</key>
\t<true/>
\t<key>LSApplicationQueriesSchemes</key>
\t<array>
\t\t<string>upi</string>
\t\t<string>gpay</string>
\t\t<string>phonepe</string>
\t\t<string>paytmmp</string>
\t\t<string>whatsapp</string>
\t</array>\n</dict>`;
    plist = plist.replace(/<\/dict>\s*<\/plist>/, `${iosAdditions}\n</plist>`);
    fs.writeFileSync(iosPlistPath, plist, 'utf8');
    console.log('[Ekwly Native] Patched iOS Info.plist (120Hz ProMotion, Camera, UPI Schemes).');
  }
}

// --- 4. OPTIONAL CLI APK BUILDER ---
if (mode === 'apk-debug' || mode === 'apk-release') {
  if (!fs.existsSync(androidDir)) {
    console.error('[Ekwly Native] android/ folder not found. Run "pnpm cap add android" first.');
    process.exit(1);
  }
  const gradleCmd = isWindows ? 'gradlew.bat' : './gradlew';
  const task = mode === 'apk-release' ? 'assembleRelease' : 'assembleDebug';
  const env = { ...process.env };
  if (javaHome) env.JAVA_HOME = javaHome;
  if (androidSdk) env.ANDROID_HOME = androidSdk;

  console.log(`[Ekwly Native] Compiling Android ${task}...`);
  execSync(`${gradleCmd} ${task}`, { cwd: androidDir, stdio: 'inherit', env });

  const apkSubpath =
    mode === 'apk-release'
      ? path.join('app', 'build', 'outputs', 'apk', 'release')
      : path.join('app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  console.log(`\n✅ APK Ready at: ${path.join(androidDir, apkSubpath)}`);
}
