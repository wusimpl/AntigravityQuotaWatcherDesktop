# <img src="./resources/icon.png" width="80" style="vertical-align: middle"> AG Quota Watcher Desktop

#### Choose Your Language:  [简体中文](./README.md) | English

> [!CAUTION]
> This application requires logging in with a Google account and obtaining an Access Token. The token is stored locally only and will not be uploaded to any server.
> However, please note: **Anyone with your token can access your Google Cloud resources**. Please keep your configuration files safe.

**A standalone desktop application for real-time monitoring of Google Antigravity AI model remaining quota.**

This is the desktop version of [Antigravity Quota Watcher](https://github.com/wusimpl/AntigravityQuotaWatcher) extension. No local Antigravity environment required, check your quota anytime, anywhere.

## Demo

<table>
  <tr>
    <td align="center">
      <strong>Widget</strong><br><br>
      <img src="./images/widget.png" alt="Widget" width="280">
    </td>
    <td align="center">
      <strong>System Tray</strong><br><br>
      <img src="./images/tray.png" alt="System Tray" width="200">
    </td>
    <td align="center">
      <strong>Settings</strong><br><br>
      <img src="./images/settings.png" alt="Settings" width="400">
    </td>
  </tr>
</table>

## System Requirements

![Windows](https://img.shields.io/badge/Windows-Supported-brightgreen?logo=microsoftwindows&logoColor=white)
![macOS](https://img.shields.io/badge/macOS-Supported-brightgreen?logo=apple&logoColor=white)

## Installation

### Windows

[Download the latest release](https://github.com/wusimpl/ag-quota-desktop/releases/latest) `.exe` installer and run it.

### macOS

[Download the latest release](https://github.com/wusimpl/ag-quota-desktop/releases/latest) `.dmg` file and drag it to your Applications folder.

## Usage

### First Time Setup

1. After launching the app, click the tray icon to open settings
2. Click "Add Account" to log in with your Google account
3. After successful login, select the models you want to monitor (up to 2 for the widget)
4. Enable "Show Widget" to display quota information on your desktop

### Widget

The widget features a "Twin Energy Capsule" design, showing up to 2 models:

- Left blue area shows the first model
- Right orange area shows the second model
- Water level indicates remaining quota percentage
- Drag to any position, the position will be saved automatically

### Settings Page

In the settings page you can:

- Manage Google accounts (add/remove)
- Select models to display in the widget
- Set model aliases (e.g., shorten "gemini-3-pro" to "G Pro")
- Adjust refresh interval, warning thresholds, etc.

### Tray Menu

Right-click the tray icon to:

- Show/Hide widget
- Refresh quota immediately
- Open settings
- Quit the app

## Quota Status Colors

Same as the extension version, quota status is color-coded:

- **Green**: Remaining quota ≥ 50% (Sufficient)
- **Yellow**: Remaining quota 30%-50% (Warning)
- **Red**: Remaining quota < 30% (Low)
- **Gray**: Quota exhausted (0%)

Thresholds can be customized in settings.

## FAQ

### Browser doesn't open during login?

The browser should open automatically during login. If it doesn't, you can manually copy the link from the dialog to your browser.

### Widget disappeared?

Right-click the tray icon and select "Show Widget".

### Quota not updating?

1. Check your network connection
2. Try removing and re-adding your account
3. Click "Refresh Now" to manually refresh

## Submitting Issues

When submitting an issue, please include:
- Your operating system version
- Steps to reproduce the problem
- Screenshots if there are any errors

## Usage Agreement

This project is open source under the GPL-3.0 License. Please comply with the license when using this project.

Additionally, please be aware of the following:

1. When redistributing, **please keep the source attribution**: [https://github.com/wusimpl/ag-quota-desktop](https://github.com/wusimpl/ag-quota-desktop)
2. Please do not use for commercial purposes, use the code legally and compliantly
3. If the license changes, it will be updated in this GitHub repository without further notice

## Acknowledgements

- [Antigravity Quota Watcher](https://github.com/wusimpl/AntigravityQuotaWatcher) - The extension version of this project
- [Antigravity-Manager](https://github.com/xisuo67/Antigravity-Manager) - Reference for Google API login flow

## License

GPL-3.0 License
