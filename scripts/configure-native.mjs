import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const rootDir = process.cwd();
const isWindows = os.platform() === 'win32';
// Modes: 'patch' | 'keygen' | 'icons' | 'apk-debug' | 'apk-release' | 'aab-release'
const mode = process.argv[2] || 'patch';
const isFullBuild = process.argv.includes('--full');

// Target versions for Capacitor 8.5.x
const TARGET_GRADLE_VERSION = '8.14.3';
const TARGET_AGP_VERSION = '8.13.0';
const APP_VERSION_CODE = Number(process.env.EKWLY_VERSION_CODE || 1);
const APP_VERSION_NAME = process.env.EKWLY_VERSION_NAME || '1.0.0';

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

function ensureUploadKeystore() {
  fs.mkdirSync(androidDir, { recursive: true });
  const keystorePath = path.join(androidDir, 'ekwly-upload-key.jks');
  const propsPath = path.join(androidDir, 'keystore.properties');

  const keytoolBin = javaHome
    ? `"${path.join(javaHome, 'bin', isWindows ? 'keytool.exe' : 'keytool')}"`
    : 'keytool';
  const password = process.env.EKWLY_KEYSTORE_PASS || 'ekwlyRelease2026!';
  const alias = 'ekwly-upload';
  const dname = 'CN=Lakshit Loy Dutta, OU=Ekwly Engineering, O=Ekwly, L=Guwahati, ST=Assam, C=IN';

  if (!fs.existsSync(keystorePath)) {
    console.log('[Ekwly Native] Generating 2048-bit RSA Upload Keystore for Google Play...');
    execSync(
      `${keytoolBin} -genkeypair -v -keystore "${keystorePath}" -keyalg RSA -keysize 2048 -validity 10000 -alias ${alias} -storepass "${password}" -keypass "${password}" -dname "${dname}"`,
      { stdio: 'inherit' }
    );
  } else {
    console.log(`[Ekwly Native] Using upload keystore -> ${keystorePath}`);
  }

  // Always normalize keystore.properties so storeFile resolves cleanly relative to rootProject (android/)
  if (!fs.existsSync(propsPath)) {
    const propsContent = [
      'storeFile=ekwly-upload-key.jks',
      `storePassword=${password}`,
      `keyAlias=${alias}`,
      `keyPassword=${password}`,
      '',
    ].join('\n');
    fs.writeFileSync(propsPath, propsContent, 'utf8');
  } else {
    let existingProps = fs.readFileSync(propsPath, 'utf8');
    if (existingProps.includes('storeFile=../ekwly-upload-key.jks')) {
      existingProps = existingProps.replace(
        'storeFile=../ekwly-upload-key.jks',
        'storeFile=ekwly-upload-key.jks'
      );
      fs.writeFileSync(propsPath, existingProps, 'utf8');
    }
  }
}

// --- 2. KEYSTORE GENERATOR MODE ('keygen') ---
if (mode === 'keygen') {
  ensureUploadKeystore();
  process.exit(0);
}

// --- 3. NATIVE ADAPTIVE ICONS & SPLASH SYNC MODE ('icons') ---
if (mode === 'icons') {
  const resourcesDir = path.join(rootDir, 'resources');
  const required = [
    'icon-only.png',
    'icon-foreground.png',
    'icon-background.png',
    'splash.png',
    'splash-dark.png',
  ];
  const missing = required.filter((f) => !fs.existsSync(path.join(resourcesDir, f)));

  if (missing.length > 0) {
    console.error(`[Ekwly Native] Missing in resources/: ${missing.join(', ')}`);
    console.error(
      'Open brand-kit/export-png-and-gif.html, click "2. Download All 5 resources/ PNGs", and place them in resources/.'
    );
    process.exit(1);
  }

  console.log('[Ekwly Native] Generating Android Adaptive Icons, iOS AppIcons & Splash Screens...');
  execSync(
    'pnpm dlx @capacitor/assets generate --iconBackgroundColor "#071226" --iconBackgroundColorDark "#071226" --splashBackgroundColor "#f2f8ff" --splashBackgroundColorDark "#050914"',
    { cwd: rootDir, stdio: 'inherit' }
  );
  console.log('✅ Native Android & iOS Icons and Splash Screens synced!');
  process.exit(0);
}

// --- 4. OPTIONAL FULL WEB BUILD & CAPACITOR SYNC (--full) ---
if (isFullBuild) {
  const buildEnv = { ...process.env, CAPACITOR_BUILD: 'true' };
  console.log('[Ekwly Native] Building static Astro bundle with CAPACITOR_BUILD=true...');
  execSync('pnpm astro build', { cwd: rootDir, stdio: 'inherit', env: buildEnv });

  if (!fs.existsSync(androidDir)) {
    console.log('[Ekwly Native] Initializing Capacitor Android platform...');
    execSync('pnpm cap add android', { cwd: rootDir, stdio: 'inherit', env: buildEnv });
  }

  console.log('[Ekwly Native] Syncing web assets into Capacitor Android...');
  execSync('pnpm cap sync android', { cwd: rootDir, stdio: 'inherit', env: buildEnv });
}

// Auto-ensure upload keystore exists before any release build
if (mode === 'aab-release' || mode === 'apk-release') {
  ensureUploadKeystore();
}

// --- 5. ENFORCE LATEST COMPATIBLE GRADLE, AGP, SDK 36, JDK 21 & RELEASE SIGNING ---
if (fs.existsSync(androidDir)) {
  // 5a. Link Android SDK in local.properties
  if (androidSdk) {
    const escapedSdk = androidSdk.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
    fs.writeFileSync(path.join(androidDir, 'local.properties'), `sdk.dir=${escapedSdk}\n`, 'utf8');
    console.log(`[Ekwly Native] Linked Android SDK -> ${androidSdk}`);
  }

  // 5b. Pin Gradle Wrapper to 8.14.3
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

  // 5c. Upgrade Root build.gradle to AGP 8.13.0
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

  // 5d. Upgrade variables.gradle to Android SDK 36 & minSdk 24
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

  // 5e. Self-Healing Patch for android/app/build.gradle (versionCode, versionName & Release Signing)
  const appBuildGradlePath = path.join(androidDir, 'app', 'build.gradle');
  if (fs.existsSync(appBuildGradlePath)) {
    let appGradle = fs.readFileSync(appBuildGradlePath, 'utf8');

    appGradle = appGradle
      .replace(/versionCode\s+\d+/g, `versionCode ${APP_VERSION_CODE}`)
      .replace(/versionName\s+["'][^"']+["']/g, `versionName "${APP_VERSION_NAME}"`);

    // 1. Ensure keystoreProperties loader exists at the top of app/build.gradle
    if (!appGradle.includes('keystorePropertiesFile')) {
      const signingLoaderBlock = [
        'def keystorePropertiesFile = rootProject.file("keystore.properties")',
        'def keystoreProperties = new Properties()',
        'if (keystorePropertiesFile.exists()) {',
        '    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))',
        '}',
      ].join('\n');
      appGradle = signingLoaderBlock + '\n\n' + appGradle;
    }

    // 2. Clean out any previous signingConfigs / lint blocks and any misplaced signingConfig lines
    appGradle = appGradle.replace(
      /\s*signingConfigs\s*\{[\s\S]*?\}\s*(?:lint\s*\{[\s\S]*?\}\s*)?(?=buildTypes\s*\{)/,
      '\n    '
    );
    appGradle = appGradle.replace(
      /\s*if\s*\(keystorePropertiesFile\.exists\(\)\)\s*\{\s*signingConfig\s+signingConfigs\.release\s*\}/g,
      ''
    );

    // 3. Inject clean signingConfigs + lint right before buildTypes, and signingConfig strictly inside buildTypes.release
    const cleanSigningAndBuildTypes = `    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                storeFile rootProject.file(keystoreProperties.getProperty("storeFile"))
                storePassword keystoreProperties.getProperty("storePassword")
                keyAlias keystoreProperties.getProperty("keyAlias")
                keyPassword keystoreProperties.getProperty("keyPassword")
            }
        }
    }
    lint {
        checkReleaseBuilds false
        abortOnError false
    }
    buildTypes {`;

    appGradle = appGradle.replace(/buildTypes\s*\{/, cleanSigningAndBuildTypes);
    appGradle = appGradle.replace(
      /(buildTypes\s*\{\s*release\s*\{)/,
      `$1\n            if (keystorePropertiesFile.exists()) {\n                signingConfig signingConfigs.release\n            }`
    );

    fs.writeFileSync(appBuildGradlePath, appGradle, 'utf8');
    console.log(
      `[Ekwly Native] Configured app/build.gradle -> v${APP_VERSION_NAME} (code ${APP_VERSION_CODE}) + Release Signing`
    );
  }

  // 5f. Link JBR 21 in gradle.properties
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

// --- 6. PATCH ANDROID MANIFEST ---
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

// --- 7. PATCH iOS INFO.PLIST ---
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

// --- 8. CLI APK & PLAY STORE AAB BUNDLE COMPILER ---
if (mode === 'apk-debug' || mode === 'apk-release' || mode === 'aab-release') {
  if (!fs.existsSync(androidDir)) {
    console.error('[Ekwly Native] android/ folder not found. Run "pnpm cap add android" first.');
    process.exit(1);
  }
  const gradleCmd = isWindows ? 'gradlew.bat' : './gradlew';
  const task =
    mode === 'aab-release'
      ? 'bundleRelease'
      : mode === 'apk-release'
        ? 'assembleRelease'
        : 'assembleDebug';

  const env = { ...process.env };
  if (javaHome) env.JAVA_HOME = javaHome;
  if (androidSdk) env.ANDROID_HOME = androidSdk;

  console.log(`[Ekwly Native] Compiling Android ${task}...`);
  execSync(`${gradleCmd} ${task}`, { cwd: androidDir, stdio: 'inherit', env });

  const outputPath =
    mode === 'aab-release'
      ? path.join(androidDir, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab')
      : mode === 'apk-release'
        ? path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk')
        : path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

  console.log(`\n✅ Build Artifact Ready at: ${outputPath}`);
}
