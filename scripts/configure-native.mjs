import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const rootDir = process.cwd();
const isWindows = os.platform() === 'win32';
// Modes: 'patch' | 'keygen' | 'icons' | 'apk-debug' | 'apk-release' | 'aab-release'
const mode = process.argv[2] || 'patch';
const isFullBuild = process.argv.includes('--full');

// Metadata & Target Versions for Ekwly v1.0.0 (Capacitor 8.5.x)
const APP_DISPLAY_NAME = process.env.EKWLY_APP_NAME || 'Ekwly';
const APP_PACKAGE_ID = process.env.EKWLY_APP_ID || 'com.ekwly.app';
const APP_VERSION_CODE = Number(process.env.EKWLY_VERSION_CODE || 1);
const APP_VERSION_NAME = process.env.EKWLY_VERSION_NAME || '1.0.0';
const TARGET_GRADLE_VERSION = '8.14.3';
const TARGET_AGP_VERSION = '8.13.0';

// Locked v3 Equilibrium Monolith Vector Paths (for Native Android Vector Drawables)
const E_PATH =
  'M 23.75 7.25 L 82.25 7.25 A 6.00 6.00 0 0 1 88.25 13.25 L 88.25 15.15 A 6.00 6.00 0 0 1 82.25 21.15 L 36.13 21.15 A 7.00 7.00 0 0 0 29.13 28.15 L 29.13 36.05 A 7.00 7.00 0 0 0 36.13 43.05 L 62.15 43.05 A 6.00 6.00 0 0 1 68.15 49.05 L 68.15 50.95 A 6.00 6.00 0 0 1 62.15 56.95 L 36.13 56.95 A 7.00 7.00 0 0 0 29.13 63.95 L 29.13 71.85 A 7.00 7.00 0 0 0 36.13 78.85 L 82.25 78.85 A 6.00 6.00 0 0 1 88.25 84.85 L 88.25 86.75 A 6.00 6.00 0 0 1 82.25 92.75 L 23.75 92.75 A 12.00 12.00 0 0 1 11.75 80.75 L 11.75 19.25 A 12.00 12.00 0 0 1 23.75 7.25 Z';
const EQ_TOP_PATH =
  'M 43.63 25.15 L 72.26 25.15 A 6.00 6.00 0 0 1 78.26 31.15 L 78.26 33.05 A 6.00 6.00 0 0 1 72.26 39.05 L 43.63 39.05 A 6.00 6.00 0 0 1 37.63 33.05 L 37.63 31.15 A 6.00 6.00 0 0 1 43.63 25.15 Z';
const EQ_BOT_PATH =
  'M 43.63 60.95 L 72.26 60.95 A 6.00 6.00 0 0 1 78.26 66.95 L 78.26 68.85 A 6.00 6.00 0 0 1 72.26 74.85 L 43.63 74.85 A 6.00 6.00 0 0 1 37.63 68.85 L 37.63 66.95 A 6.00 6.00 0 0 1 43.63 60.95 Z';

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
function syncRasterCapacitorAssetsIfPresent(requireAll = false) {
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
    if (requireAll) {
      console.error(`[Ekwly Native] Missing in resources/: ${missing.join(', ')}`);
      console.error(
        'Open brand-kit/export-png-and-gif.html, click "2. Download All 5 resources/ PNGs", and place them in resources/.'
      );
      process.exit(1);
    }
    return;
  }

  console.log(
    '[Ekwly Native] Generating raster mipmap PNGs & Splash Screens via @capacitor/assets...'
  );
  execSync(
    'pnpm dlx @capacitor/assets generate --iconBackgroundColor "#071226" --iconBackgroundColorDark "#071226" --splashBackgroundColor "#f2f8ff" --splashBackgroundColorDark "#050914"',
    { cwd: rootDir, stdio: 'inherit' }
  );
}

if (mode === 'icons') {
  syncRasterCapacitorAssetsIfPresent(true);
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

  syncRasterCapacitorAssetsIfPresent(false);
}

// Auto-ensure upload keystore exists before any release build
if (mode === 'aab-release' || mode === 'apk-release') {
  ensureUploadKeystore();
}

// --- 5. INJECT NATIVE ANDROID VECTOR ADAPTIVE ICON, SPLASH & METADATA ---
function injectAndroidBrandAndMetadata() {
  const resDir = path.join(androidDir, 'app', 'src', 'main', 'res');
  if (!fs.existsSync(resDir)) return;

  const drawableDir = path.join(resDir, 'drawable');
  const valuesDir = path.join(resDir, 'values');
  const anydpiDir = path.join(resDir, 'mipmap-anydpi-v26');
  fs.mkdirSync(drawableDir, { recursive: true });
  fs.mkdirSync(valuesDir, { recursive: true });
  fs.mkdirSync(anydpiDir, { recursive: true });

  // 5.0 Clean up any conflicting Capacitor template drawables (splash.png in drawable* and v24 foreground)
  for (const entry of fs.readdirSync(resDir)) {
    if (entry.startsWith('drawable')) {
      const candidateSplashPng = path.join(resDir, entry, 'splash.png');
      if (fs.existsSync(candidateSplashPng)) {
        fs.unlinkSync(candidateSplashPng);
      }
      const candidateV24Fg = path.join(resDir, entry, 'ic_launcher_foreground.xml');
      if (entry !== 'drawable' && fs.existsSync(candidateV24Fg)) {
        fs.unlinkSync(candidateV24Fg);
      }
    }
  }

  // 5.1 Write Native Vector Adaptive Foreground (108dp canvas, 0.54x scale centered at 54,54 inside 66dp safe circle)
  const fgXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <group
        android:scaleX="0.54"
        android:scaleY="0.54"
        android:translateX="27"
        android:translateY="27">
        <path
            android:fillColor="#FFFFFF"
            android:pathData="${E_PATH}" />
        <path
            android:fillColor="#0080FF"
            android:pathData="${EQ_TOP_PATH}" />
        <path
            android:fillColor="#38BDF8"
            android:pathData="${EQ_BOT_PATH}" />
    </group>
</vector>
`;
  fs.writeFileSync(path.join(drawableDir, 'ic_launcher_foreground.xml'), fgXml, 'utf8');

  // 5.2 Write Native Vector Adaptive Background (#071226 -> #0F2342 Deep Slate Gradient)
  const bgXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:aapt="http://schemas.android.com/aapt"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path android:pathData="M0,0h108v108h-108z">
        <aapt:attr name="android:fillColor">
            <gradient
                android:startX="0"
                android:startY="0"
                android:endX="108"
                android:endY="108"
                android:type="linear">
                <item android:offset="0.0" android:color="#071226" />
                <item android:offset="1.0" android:color="#0F2342" />
            </gradient>
        </aapt:attr>
    </path>
</vector>
`;
  fs.writeFileSync(path.join(drawableDir, 'ic_launcher_background.xml'), bgXml, 'utf8');

  // 5.3 Point mipmap-anydpi-v26/ic_launcher.xml & ic_launcher_round.xml to our Vector Drawables
  const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
    <monochrome android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>
`;
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher.xml'), adaptiveXml, 'utf8');
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher_round.xml'), adaptiveXml, 'utf8');

  // 5.4 Write Native Vector Boot Splash Screen (drawable/splash.xml)
  const splashXml = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item>
        <shape android:shape="rectangle">
            <solid android:color="#050914" />
        </shape>
    </item>
    <item
        android:width="144dp"
        android:height="144dp"
        android:gravity="center"
        android:drawable="@drawable/ic_launcher_foreground" />
</layer-list>
`;
  fs.writeFileSync(path.join(drawableDir, 'splash.xml'), splashXml, 'utf8');

  // 5.5 Write values/strings.xml (App Name, Activity Title & URL Scheme)
  const stringsXml = `<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">${APP_DISPLAY_NAME}</string>
    <string name="title_activity_main">${APP_DISPLAY_NAME}</string>
    <string name="package_name">${APP_PACKAGE_ID}</string>
    <string name="custom_url_scheme">${APP_PACKAGE_ID}</string>
</resources>
`;
  fs.writeFileSync(path.join(valuesDir, 'strings.xml'), stringsXml, 'utf8');

  // 5.6 Write values/ic_launcher_background.xml & values/colors.xml (without duplicate color keys)
  const launcherBgColorXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#071226</color>
</resources>
`;
  fs.writeFileSync(path.join(valuesDir, 'ic_launcher_background.xml'), launcherBgColorXml, 'utf8');

  const colorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#0080FF</color>
    <color name="colorPrimaryDark">#050914</color>
    <color name="colorAccent">#38BDF8</color>
</resources>
`;
  fs.writeFileSync(path.join(valuesDir, 'colors.xml'), colorsXml, 'utf8');

  // 5.7 Write values/styles.xml (OLED #050914 Window Background, Status Bar & Navigation Bar)
  const stylesXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
        <item name="android:windowBackground">@color/colorPrimaryDark</item>
        <item name="android:statusBarColor">@color/colorPrimaryDark</item>
        <item name="android:navigationBarColor">@color/colorPrimaryDark</item>
    </style>

    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
        <item name="android:windowBackground">@color/colorPrimaryDark</item>
        <item name="android:statusBarColor">@color/colorPrimaryDark</item>
        <item name="android:navigationBarColor">@color/colorPrimaryDark</item>
    </style>

    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="android:background">@drawable/splash</item>
        <item name="windowSplashScreenBackground">#050914</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/ic_launcher_foreground</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>
</resources>
`;
  fs.writeFileSync(path.join(valuesDir, 'styles.xml'), stylesXml, 'utf8');

  console.log(
    '[Ekwly Native] Injected Vector Adaptive Icon (Android 8-16 + Android 13 Monochrome), Splash & App Metadata.'
  );
}

// --- 6. ENFORCE LATEST COMPATIBLE GRADLE, AGP, SDK 36, JDK 21 & RELEASE SIGNING ---
if (fs.existsSync(androidDir)) {
  injectAndroidBrandAndMetadata();

  if (mode === 'icons') {
    process.exit(0);
  }

  // 6a. Link Android SDK in local.properties
  if (androidSdk) {
    const escapedSdk = androidSdk.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
    fs.writeFileSync(path.join(androidDir, 'local.properties'), `sdk.dir=${escapedSdk}\n`, 'utf8');
    console.log(`[Ekwly Native] Linked Android SDK -> ${androidSdk}`);
  }

  // 6b. Pin Gradle Wrapper to 8.14.3
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

  // 6c. Upgrade Root build.gradle to AGP 8.13.0
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

  // 6d. Upgrade variables.gradle to Android SDK 36 & minSdk 24
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

  // 6e. Self-Healing Patch for android/app/build.gradle (versionCode, versionName & Release Signing)
  const appBuildGradlePath = path.join(androidDir, 'app', 'build.gradle');
  if (fs.existsSync(appBuildGradlePath)) {
    let appGradle = fs.readFileSync(appBuildGradlePath, 'utf8');

    appGradle = appGradle
      .replace(/applicationId\s+["'][^"']+["']/g, `applicationId "${APP_PACKAGE_ID}"`)
      .replace(/versionCode\s+\d+/g, `versionCode ${APP_VERSION_CODE}`)
      .replace(/versionName\s+["'][^"']+["']/g, `versionName "${APP_VERSION_NAME}"`);

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

    appGradle = appGradle.replace(
      /\s*signingConfigs\s*\{[\s\S]*?\}\s*(?:lint\s*\{[\s\S]*?\}\s*)?(?=buildTypes\s*\{)/,
      '\n    '
    );
    appGradle = appGradle.replace(
      /\s*if\s*\(keystorePropertiesFile\.exists\(\)\)\s*\{\s*signingConfig\s+signingConfigs\.release\s*\}/g,
      ''
    );

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
      `[Ekwly Native] Configured app/build.gradle -> ${APP_PACKAGE_ID} v${APP_VERSION_NAME} (code ${APP_VERSION_CODE}) + Release Signing`
    );
  }

  // 6f. Link JBR 21 in gradle.properties
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

// --- 7. PATCH ANDROID MANIFEST ---
const androidManifestPath = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(androidManifestPath)) {
  let manifest = fs.readFileSync(androidManifestPath, 'utf8');

  if (!manifest.includes('android:hardwareAccelerated="true"')) {
    manifest = manifest.replace(
      '<application',
      '<application\n        android:hardwareAccelerated="true"'
    );
  }

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
    '[Ekwly Native] Patched AndroidManifest.xml (240Hz Hardware Acceleration, Camera, Vibrate, ML Kit, UPI & WhatsApp).'
  );
}

// --- 8. PATCH iOS INFO.PLIST ---
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

// --- 9. CLI APK & PLAY STORE AAB BUNDLE COMPILER ---
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
