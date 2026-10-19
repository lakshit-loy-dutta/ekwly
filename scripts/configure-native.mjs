import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const rootDir = process.cwd();
const isWindows = os.platform() === 'win32';
const mode = process.argv[2] || 'patch'; // 'patch' | 'apk-debug' | 'apk-release'

// Target versions for Capacitor 8.5.x
const TARGET_GRADLE_VERSION = '8.14.3';
const TARGET_AGP_VERSION = '8.13.0';

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
const androidDir = path.join(rootDir, 'android');

// --- 2. ENFORCE LATEST COMPATIBLE GRADLE, AGP, SDK 36 & JDK 21 ---
if (fs.existsSync(androidDir)) {
  // 2a. Link Android SDK in local.properties
  if (androidSdk) {
    const escapedSdk = androidSdk.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
    fs.writeFileSync(path.join(androidDir, 'local.properties'), `sdk.dir=${escapedSdk}\n`, 'utf8');
    console.log(`[Ekwly Native] Linked Android SDK -> ${androidSdk}`);
  }

  // 2b. Pin Gradle Wrapper away from 9.6.x (which removed InternalProblems needed by AGP 8)
  const wrapperPropsPath = path.join(androidDir, 'gradle', 'wrapper', 'gradle-wrapper.properties');
  if (fs.existsSync(wrapperPropsPath)) {
    let wrapperProps = fs.readFileSync(wrapperPropsPath, 'utf8');
    wrapperProps = wrapperProps.replace(
      /^distributionUrl=.*$/m,
      `distributionUrl=https\\://services.gradle.org/distributions/gradle-${TARGET_GRADLE_VERSION}-all.zip`
    );
    fs.writeFileSync(wrapperPropsPath, wrapperProps, 'utf8');
    console.log(`[Ekwly Native] Pinned Gradle Wrapper -> ${TARGET_GRADLE_VERSION}`);
  }

  // 2c. Upgrade Root build.gradle to AGP 8.13.0
  const rootBuildGradlePath = path.join(androidDir, 'build.gradle');
  if (fs.existsSync(rootBuildGradlePath)) {
    let rootGradle = fs.readFileSync(rootBuildGradlePath, 'utf8');
    rootGradle = rootGradle.replace(
      /classpath\s+['"]com\.android\.tools\.build:gradle:[^'"]+['"]/g,
      `classpath 'com.android.tools.build:gradle:${TARGET_AGP_VERSION}'`
    );
    fs.writeFileSync(rootBuildGradlePath, rootGradle, 'utf8');
    console.log(`[Ekwly Native] Pinned Android Gradle Plugin -> ${TARGET_AGP_VERSION}`);
  }

  // 2d. Upgrade variables.gradle to Android SDK 36 & minSdk 24
  const varsGradlePath = path.join(androidDir, 'variables.gradle');
  if (fs.existsSync(varsGradlePath)) {
    let varsGradle = fs.readFileSync(varsGradlePath, 'utf8');
    varsGradle = varsGradle
      .replace(/minSdkVersion\s*=\s*\d+/g, 'minSdkVersion = 24')
      .replace(/compileSdkVersion\s*=\s*\d+/g, 'compileSdkVersion = 36')
      .replace(/targetSdkVersion\s*=\s*\d+/g, 'targetSdkVersion = 36');
    fs.writeFileSync(varsGradlePath, varsGradle, 'utf8');
    console.log(
      '[Ekwly Native] Upgraded variables.gradle -> compileSdk 36, targetSdk 36, minSdk 24'
    );
  }

  // 2e. Link JBR 21 in gradle.properties
  const gradlePropsPath = path.join(androidDir, 'gradle.properties');
  if (fs.existsSync(gradlePropsPath)) {
    let gradleProps = fs.readFileSync(gradlePropsPath, 'utf8');
    if (javaHome) {
      const escapedJava = javaHome.replace(/\\/g, '/');
      if (gradleProps.includes('org.gradle.java.home=')) {
        gradleProps = gradleProps.replace(
          /^org\.gradle\.java\.home=.*$/m,
          `org.gradle.java.home=${escapedJava}`
        );
      } else {
        gradleProps += `\n# Auto-configured by Ekwly configure-native.mjs\norg.gradle.java.home=${escapedJava}\norg.gradle.parallel=true\norg.gradle.caching=true\n`;
      }
      fs.writeFileSync(gradlePropsPath, gradleProps, 'utf8');
      console.log(`[Ekwly Native] Linked Gradle JDK 21 -> ${javaHome}`);
    }
  }
}

// --- 3. PATCH ANDROID MANIFEST ---
const androidManifestPath = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
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

// --- 4. PATCH iOS INFO.PLIST ---
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

// --- 5. OPTIONAL CLI APK BUILDER ---
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
