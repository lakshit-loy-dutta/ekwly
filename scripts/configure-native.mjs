import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const rootDir = process.cwd();
const isWindows = os.platform() === 'win32';

// Modes: 'patch' | 'doctor' | 'keygen' | 'icons' | 'apk-debug' | 'apk-release' | 'aab-release'
const mode = process.argv[2] || 'patch';
const isFullBuild = process.argv.includes('--full');

// --- 0. LOAD .ENV & READ DYNAMIC PROJECT METADATA FROM PACKAGE.JSON + CAPACITOR.CONFIG.JSON ---
function loadLocalEnv() {
  for (const envFile of ['.env', '.env.local']) {
    const fullPath = path.join(rootDir, envFile);
    if (!fs.existsSync(fullPath)) continue;
    for (const rawLine of fs.readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}

loadLocalEnv();

const pkgJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const capConfig = JSON.parse(fs.readFileSync(path.join(rootDir, 'capacitor.config.json'), 'utf8'));

function semverToVersionCode(versionStr) {
  const parts = String(versionStr || '1.0.0')
    .replace(/[^0-9.]/g, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const [major = 1, minor = 0, patch = 0] = parts;
  return Math.max(1, major * 10000 + minor * 100 + patch);
}

const APP_DISPLAY_NAME = process.env.EKWLY_APP_NAME || capConfig.appName || 'Ekwly';
const APP_PACKAGE_ID = process.env.EKWLY_APP_ID || capConfig.appId || 'com.ekwly.app';
const APP_VERSION_NAME = process.env.EKWLY_VERSION_NAME || pkgJson.version || '1.0.0';
const APP_VERSION_CODE = Number(
  process.env.EKWLY_VERSION_CODE || semverToVersionCode(APP_VERSION_NAME)
);

// Official Capacitor 8.x Verified Toolchain Compatibility Matrix (Nov 2026)
const TOOLCHAIN_MATRIX = {
  8: {
    capacitorRange: '8.6.x (Latest Stable)',
    gradle: '8.14.3',
    agp: '8.13.0',
    kotlin: '2.2.20',
    minSdk: 24,
    compileSdk: 36,
    targetSdk: 36,
    iosDeploymentTarget: '15.0',
    jdkMajor: 21,
  },
};

function getInstalledPackageVersion(pkgName) {
  try {
    const p = path.join(rootDir, 'node_modules', ...pkgName.split('/'), 'package.json');
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8')).version;
    }
  } catch {
    // Fallback to package.json spec
  }
  const raw = pkgJson.dependencies?.[pkgName] || pkgJson.devDependencies?.[pkgName] || '8.6.2';
  return String(raw).replace(/^[^0-9]*/, '');
}

const installedCapCore = getInstalledPackageVersion('@capacitor/core');
const capMajor = parseInt(installedCapCore.split('.')[0], 10) || 8;
const activeMatrix = TOOLCHAIN_MATRIX[capMajor] || TOOLCHAIN_MATRIX[8];

const TARGET_GRADLE_VERSION = process.env.EKWLY_GRADLE_VERSION || activeMatrix.gradle;
const TARGET_AGP_VERSION = process.env.EKWLY_AGP_VERSION || activeMatrix.agp;

// Locked v3 Equilibrium Monolith Vector Paths (for Native Android Vector Drawables)
const E_PATH =
  'M 23.75 7.25 L 82.25 7.25 A 6.00 6.00 0 0 1 88.25 13.25 L 88.25 15.15 A 6.00 6.00 0 0 1 82.25 21.15 L 36.13 21.15 A 7.00 7.00 0 0 0 29.13 28.15 L 29.13 36.05 A 7.00 7.00 0 0 0 36.13 43.05 L 62.15 43.05 A 6.00 6.00 0 0 1 68.15 49.05 L 68.15 50.95 A 6.00 6.00 0 0 1 62.15 56.95 L 36.13 56.95 A 7.00 7.00 0 0 0 29.13 63.95 L 29.13 71.85 A 7.00 7.00 0 0 0 36.13 78.85 L 82.25 78.85 A 6.00 6.00 0 0 1 88.25 84.85 L 88.25 86.75 A 6.00 6.00 0 0 1 82.25 92.75 L 23.75 92.75 A 12.00 12.00 0 0 1 11.75 80.75 L 11.75 19.25 A 12.00 12.00 0 0 1 23.75 7.25 Z';
const EQ_TOP_PATH =
  'M 43.63 25.15 L 72.26 25.15 A 6.00 6.00 0 0 1 78.26 31.15 L 78.26 33.05 A 6.00 6.00 0 0 1 72.26 39.05 L 43.63 39.05 A 6.00 6.00 0 0 1 37.63 33.05 L 37.63 31.15 A 6.00 6.00 0 0 1 43.63 25.15 Z';
const EQ_BOT_PATH =
  'M 43.63 60.95 L 72.26 60.95 A 6.00 6.00 0 0 1 78.26 66.95 L 78.26 68.85 A 6.00 6.00 0 0 1 72.26 74.85 L 43.63 74.85 A 6.00 6.00 0 0 1 37.63 68.85 L 37.63 66.95 A 6.00 6.00 0 0 1 43.63 60.95 Z';

// --- 1. AUTO-DETECT JDK 21 & ANDROID SDK ---
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
  } else if (os.platform() === 'darwin') {
    const macJbr = '/Applications/Android Studio.app/Contents/jbr/Contents/Home';
    if (fs.existsSync(macJbr)) return macJbr;
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
  } else if (os.platform() === 'darwin') {
    const macSdk = path.join(os.homedir(), 'Library', 'Android', 'sdk');
    if (fs.existsSync(macSdk)) return macSdk;
  }
  return null;
}

const javaHome = findJavaHome();
const androidSdk = findAndroidSdk();
const androidDir = path.join(rootDir, 'android');

// --- 2. DOCTOR & LIVE VERSION CHECK MODE ('doctor') ---
async function runDoctor() {
  console.log(
    `\n=== Ekwly Native Toolchain Doctor (${APP_DISPLAY_NAME} v${APP_VERSION_NAME}, code ${APP_VERSION_CODE}) ===\n`
  );

  const packagesToCheck = [
    '@capacitor/core',
    '@capacitor/cli',
    '@capacitor/android',
    '@capacitor/ios',
    '@capacitor/app',
    '@capacitor/camera',
    '@capacitor-mlkit/barcode-scanning',
    '@capgo/capacitor-updater',
  ];

  console.log('1. Capacitor Package Parity & Live npm Registry Check:');
  for (const pkg of packagesToCheck) {
    const localVer = getInstalledPackageVersion(pkg);
    let latestVer = 'offline';
    try {
      const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`);
      if (res.ok) {
        const data = await res.json();
        latestVer = data.version || 'unknown';
      }
    } catch {
      // Offline
    }
    const status =
      latestVer === 'offline'
        ? '(offline)'
        : localVer === latestVer
          ? '✅ up-to-date'
          : `⬆️  latest: ${latestVer}`;
    console.log(`   • ${pkg.padEnd(36)} local: ${localVer.padEnd(10)} ${status}`);
  }

  let latestGradle = 'offline';
  try {
    const gRes = await fetch('https://services.gradle.org/versions/current');
    if (gRes.ok) {
      const gData = await gRes.json();
      latestGradle = gData.version || 'unknown';
    }
  } catch {
    // Offline
  }

  console.log('\n2. Native Build Toolchain & Environment:');
  console.log(
    `   • Target Matrix (Cap ${capMajor}.x): Gradle ${TARGET_GRADLE_VERSION} (latest Gradle: ${latestGradle}) | AGP ${TARGET_AGP_VERSION} | SDK ${activeMatrix.compileSdk}`
  );
  console.log(
    `   • JDK 21+:     ${javaHome ? `✅ ${javaHome}` : '⚠️  Not auto-detected (set JAVA_HOME)'}`
  );
  console.log(
    `   • Android SDK: ${
      androidSdk
        ? `${fs.existsSync(path.join(androidSdk, 'platforms', `android-${activeMatrix.compileSdk}`)) ? '✅' : '⚠️  Missing platform android-' + activeMatrix.compileSdk} ${androidSdk}`
        : '⚠️  Not auto-detected (set ANDROID_HOME)'
    }`
  );
  console.log(
    `   • Release Key: ${
      process.env.EKWLY_KEYSTORE_PASS
        ? '✅ EKWLY_KEYSTORE_PASS configured'
        : '⚠️  EKWLY_KEYSTORE_PASS not set in .env (required for release APK/AAB)'
    }\n`
  );
}

if (mode === 'doctor') {
  await runDoctor();
  process.exit(0);
}

// --- 3. KEYSTORE GENERATOR (NO HARDCODED PASSWORD FALLBACK) ---
function ensureUploadKeystore() {
  const password = process.env.EKWLY_KEYSTORE_PASS;
  if (!password || password.trim().length < 8) {
    console.error(
      '[Ekwly Native] ERROR: EKWLY_KEYSTORE_PASS env var (min 8 chars) is required for keystore generation & release builds.'
    );
    console.error('Set EKWLY_KEYSTORE_PASS in your local .env or CI secrets and retry.');
    process.exit(1);
  }

  fs.mkdirSync(androidDir, { recursive: true });
  const keystorePath = path.join(androidDir, 'ekwly-upload-key.jks');
  const propsPath = path.join(androidDir, 'keystore.properties');

  const keytoolBin = javaHome
    ? `"${path.join(javaHome, 'bin', isWindows ? 'keytool.exe' : 'keytool')}"`
    : 'keytool';
  const alias = process.env.EKWLY_KEY_ALIAS || 'ekwly-upload';
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

  const propsContent = [
    'storeFile=ekwly-upload-key.jks',
    `storePassword=${password}`,
    `keyAlias=${alias}`,
    `keyPassword=${password}`,
    '',
  ].join('\n');
  fs.writeFileSync(propsPath, propsContent, 'utf8');
}

if (mode === 'keygen') {
  ensureUploadKeystore();
  process.exit(0);
}

// --- 4. NATIVE ADAPTIVE ICONS & SPLASH SYNC ('icons') ---
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
        'Run `node scripts/generate-brand-assets.mjs`, open brand-kit/export-png-and-gif.html, and place the 5 PNGs in resources/.'
      );
      process.exit(1);
    }
    return;
  }
  console.log('[Ekwly Native] Generating raster mipmaps & splash screens via @capacitor/assets...');
  execSync(
    'pnpm dlx @capacitor/assets generate --iconBackgroundColor "#071226" --iconBackgroundColorDark "#071226" --splashBackgroundColor "#f2f8ff" --splashBackgroundColorDark "#050914"',
    { cwd: rootDir, stdio: 'inherit' }
  );
}

if (mode === 'icons') {
  syncRasterCapacitorAssetsIfPresent(true);
}

// --- 5. OPTIONAL FULL WEB BUILD & CAPACITOR SYNC (--full) ---
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

if (mode === 'aab-release' || mode === 'apk-release') {
  ensureUploadKeystore();
}

// --- 6. INJECT NATIVE ANDROID VECTOR ADAPTIVE ICON, SPLASH, SAFE INSETS & METADATA ---
function injectAndroidBrandAndMetadata() {
  const resDir = path.join(androidDir, 'app', 'src', 'main', 'res');
  if (!fs.existsSync(resDir)) return;

  // Remove unused Capacitor template test stubs (com.getcapacitor.myapp)
  const boilerplateTests = [
    path.join(androidDir, 'app', 'src', 'androidTest', 'java', 'com', 'getcapacitor', 'myapp'),
    path.join(androidDir, 'app', 'src', 'test', 'java', 'com', 'getcapacitor', 'myapp'),
  ];
  for (const dir of boilerplateTests) {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }

  const drawableDir = path.join(resDir, 'drawable');
  const valuesDir = path.join(resDir, 'values');
  const anydpiDir = path.join(resDir, 'mipmap-anydpi-v26');
  fs.mkdirSync(drawableDir, { recursive: true });
  fs.mkdirSync(valuesDir, { recursive: true });
  fs.mkdirSync(anydpiDir, { recursive: true });

  // Clean up conflicting Capacitor template drawables
  for (const entry of fs.readdirSync(resDir)) {
    if (entry.startsWith('drawable')) {
      const candidateSplashPng = path.join(resDir, entry, 'splash.png');
      if (fs.existsSync(candidateSplashPng)) fs.unlinkSync(candidateSplashPng);
      const candidateV24Fg = path.join(resDir, entry, 'ic_launcher_foreground.xml');
      if (entry !== 'drawable' && fs.existsSync(candidateV24Fg)) fs.unlinkSync(candidateV24Fg);
    }
  }

  // Native Vector Adaptive Foreground
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

  // Native Vector Adaptive Background
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

  const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
    <monochrome android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>
`;
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher.xml'), adaptiveXml, 'utf8');
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher_round.xml'), adaptiveXml, 'utf8');

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

  const stringsXml = `<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">${APP_DISPLAY_NAME}</string>
    <string name="title_activity_main">${APP_DISPLAY_NAME}</string>
    <string name="package_name">${APP_PACKAGE_ID}</string>
    <string name="custom_url_scheme">${APP_PACKAGE_ID}</string>
</resources>
`;
  fs.writeFileSync(path.join(valuesDir, 'strings.xml'), stringsXml, 'utf8');

  fs.writeFileSync(
    path.join(valuesDir, 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#071226</color>\n</resources>\n`,
    'utf8'
  );

  fs.writeFileSync(
    path.join(valuesDir, 'colors.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="colorPrimary">#0080FF</color>\n    <color name="colorPrimaryDark">#050914</color>\n    <color name="colorAccent">#38BDF8</color>\n</resources>\n`,
    'utf8'
  );

  const stylesXml = `<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:tools="http://schemas.android.com/tools">
    <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
        <item name="android:windowBackground">@color/colorPrimaryDark</item>
        <item name="android:statusBarColor">@android:color/transparent</item>
        <item name="android:navigationBarColor">@android:color/transparent</item>
        <item name="android:enforceNavigationBarContrast" tools:targetApi="29">false</item>
    </style>
    <style name="AppTheme.NoActionBar" parent="AppTheme">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
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

  // MainActivity.java: Injects --safe-top / --safe-bottom (including display cutouts) AND propagates IME keyboard insets
  const mainActivityPath = path.join(
    androidDir,
    'app',
    'src',
    'main',
    'java',
    'com',
    'ekwly',
    'app',
    'MainActivity.java'
  );
  if (fs.existsSync(mainActivityPath)) {
    const mainActivityJava = `package com.ekwly.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);

        if (getBridge() != null && getBridge().getWebView() != null) {
            final WebView webView = getBridge().getWebView();
            webView.addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void setLightBars(final boolean isLight) {
                    runOnUiThread(() -> {
                        Window w = getWindow();
                        View decor = w.getDecorView();
                        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(w, decor);
                        if (controller != null) {
                            controller.setAppearanceLightStatusBars(isLight);
                            controller.setAppearanceLightNavigationBars(isLight);
                        }
                    });
                }
            }, "EkwlyNativeBar");

            ViewCompat.setOnApplyWindowInsetsListener(webView, (v, windowInsets) -> {
                Insets bars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                );
                Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
                float density = getResources().getDisplayMetrics().density;
                int topDp = Math.round(bars.top / density);
                int bottomDp = Math.round(Math.max(bars.bottom, ime.bottom) / density);

                String js = String.format(
                    "document.documentElement.style.setProperty('--safe-top', '%dpx');" +
                    "document.documentElement.style.setProperty('--safe-bottom', '%dpx');",
                    topDp, bottomDp
                );
                webView.post(() -> webView.evaluateJavascript(js, null));
                return ViewCompat.onApplyWindowInsets(v, windowInsets);
            });
        }
    }
}
`;
    fs.writeFileSync(mainActivityPath, mainActivityJava, 'utf8');
  }
  console.log(
    '[Ekwly Native] Injected Vector Adaptive Icon, Splash, Cutout + IME Keyboard Insets & Metadata.'
  );
}

// --- 7. SYNC GRADLE, AGP, SDK & RELEASE SIGNING ---
if (fs.existsSync(androidDir)) {
  injectAndroidBrandAndMetadata();
  if (mode === 'icons') process.exit(0);

  if (androidSdk) {
    const escapedSdk = androidSdk.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
    fs.writeFileSync(path.join(androidDir, 'local.properties'), `sdk.dir=${escapedSdk}\n`, 'utf8');
  }

  const wrapperPropsPath = path.join(androidDir, 'gradle', 'wrapper', 'gradle-wrapper.properties');
  if (fs.existsSync(wrapperPropsPath)) {
    let wrapperProps = fs.readFileSync(wrapperPropsPath, 'utf8');
    wrapperProps = wrapperProps.replace(
      /^distributionUrl=.*$/m,
      `distributionUrl=https\\://services.gradle.org/distributions/gradle-${TARGET_GRADLE_VERSION}-all.zip`
    );
    fs.writeFileSync(wrapperPropsPath, wrapperProps, 'utf8');
  }

  const rootBuildGradlePath = path.join(androidDir, 'build.gradle');
  if (fs.existsSync(rootBuildGradlePath)) {
    let rootGradle = fs.readFileSync(rootBuildGradlePath, 'utf8');
    rootGradle = rootGradle.replace(
      /classpath\s+['"]com\.android\.tools\.build:gradle:[^'"]+['"]/g,
      `classpath 'com.android.tools.build:gradle:${TARGET_AGP_VERSION}'`
    );
    fs.writeFileSync(rootBuildGradlePath, rootGradle, 'utf8');
  }

  const varsGradlePath = path.join(androidDir, 'variables.gradle');
  if (fs.existsSync(varsGradlePath)) {
    let varsGradle = fs.readFileSync(varsGradlePath, 'utf8');
    varsGradle = varsGradle
      .replace(/minSdkVersion\s*=\s*\d+/g, `minSdkVersion = ${activeMatrix.minSdk}`)
      .replace(/compileSdkVersion\s*=\s*\d+/g, `compileSdkVersion = ${activeMatrix.compileSdk}`)
      .replace(/targetSdkVersion\s*=\s*\d+/g, `targetSdkVersion = ${activeMatrix.targetSdk}`);
    fs.writeFileSync(varsGradlePath, varsGradle, 'utf8');
  }

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
    buildTypes {`;

    appGradle = appGradle.replace(/buildTypes\s*\{/, cleanSigningAndBuildTypes);
    appGradle = appGradle.replace(
      /(buildTypes\s*\{\s*release\s*\{)/,
      `$1\n            if (keystorePropertiesFile.exists()) {\n                signingConfig signingConfigs.release\n            }`
    );

    fs.writeFileSync(appBuildGradlePath, appGradle, 'utf8');
  }

  // Strip any machine-specific org.gradle.java.home line from tracked gradle.properties
  const gradlePropsPath = path.join(androidDir, 'gradle.properties');
  if (fs.existsSync(gradlePropsPath)) {
    let gradleProps = fs.readFileSync(gradlePropsPath, 'utf8');
    gradleProps = gradleProps
      .replace(/\r?\n?# Auto-configured by Ekwly configure-native\.mjs\r?\n?/g, '\n')
      .replace(/^org\.gradle\.java\.home=.*\r?\n?/gm, '');
    if (!gradleProps.includes('org.gradle.parallel=true')) {
      gradleProps += '\norg.gradle.parallel=true\norg.gradle.caching=true\n';
    }
    fs.writeFileSync(gradlePropsPath, gradleProps, 'utf8');
  }

  console.log(
    `[Ekwly Native] Synced Android -> ${APP_PACKAGE_ID} v${APP_VERSION_NAME} (code ${APP_VERSION_CODE}) | Gradle ${TARGET_GRADLE_VERSION} | AGP ${TARGET_AGP_VERSION} | SDK ${activeMatrix.compileSdk}`
  );
}

// --- 8. PATCH ANDROID MANIFEST (PERMISSIONS, UPI/WHATSAPP QUERIES & OAUTH DEEP LINK) ---
const androidManifestPath = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(androidManifestPath)) {
  let manifest = fs.readFileSync(androidManifestPath, 'utf8');

  if (!manifest.includes('android:hardwareAccelerated="true"')) {
    manifest = manifest.replace(
      '<application',
      '<application\n        android:hardwareAccelerated="true"'
    );
  }

  if (!manifest.includes(`android:scheme="${APP_PACKAGE_ID}"`)) {
    const deepLinkFilter = `            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="${APP_PACKAGE_ID}" android:host="auth-callback" />
            </intent-filter>\n        </activity>`;
    manifest = manifest.replace('</activity>', deepLinkFilter);
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
}

// --- 9. PATCH iOS INFO.PLIST (PERMISSIONS, PROMOTION, UPI SCHEMES & DEEP LINK) ---
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
\t<key>CFBundleURLTypes</key>
\t<array>
\t\t<dict>
\t\t\t<key>CFBundleURLName</key>
\t\t\t<string>${APP_PACKAGE_ID}</string>
\t\t\t<key>CFBundleURLSchemes</key>
\t\t\t<array>
\t\t\t\t<string>${APP_PACKAGE_ID}</string>
\t\t\t</array>
\t\t</dict>
\t</array>
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
  }
}

// --- 10. CLI APK & PLAY STORE AAB COMPILER (OUTPUTS TO GITIGNORED dist/native/) ---
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

  const rawOutputPath =
    mode === 'aab-release'
      ? path.join(androidDir, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab')
      : mode === 'apk-release'
        ? path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk')
        : path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

  const nativeOutDir = path.join(rootDir, 'dist', 'native');
  fs.mkdirSync(nativeOutDir, { recursive: true });
  const cleanFileName = mode === 'aab-release' ? 'Ekwly.aab' : 'Ekwly.apk';
  const finalArtifactPath = path.join(nativeOutDir, cleanFileName);

  if (fs.existsSync(rawOutputPath)) {
    fs.copyFileSync(rawOutputPath, finalArtifactPath);
    console.log(`\n✅ ${cleanFileName} Ready at: ${finalArtifactPath}`);
  } else {
    console.log(`\n✅ Build Artifact Ready at: ${rawOutputPath}`);
  }
}
