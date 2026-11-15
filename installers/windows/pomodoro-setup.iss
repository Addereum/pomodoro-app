; =====================================================================
; Inno Setup 6 Script für Pomodoro App (Windows)
; Kann mit Inno Setup Compiler zu einer eigenständigen Setup.exe kompiliert werden
; =====================================================================

#define MyAppName "Addereums Pomodoro"
#ifndef MyAppVersion
  #define MyAppVersion "1.3.7"
#endif
#define MyAppPublisher "addereum"
#define MyAppURL "https://github.com/addereum/pomodoro-app"
#define MyAppExeName "Pomodoro.exe"

[Setup]
AppId={{D37F2A38-4F18-4E44-9721-6A95B3098C22}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=Addereums-Pomodoro-Setup-{#MyAppVersion}
SetupIconFile=..\..\app\icon.ico
WizardImageFile=wizard-large.bmp
WizardSmallImageFile=wizard-small.bmp
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

[Languages]
Name: "german"; MessagesFile: "compiler:Languages\German.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "..\..\app\*"; DestDir: "{app}\app"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "launcher.ps1"; DestDir: "{app}\bin"; Flags: ignoreversion
Source: "..\..\app\icon.ico"; DestDir: "{app}\app"; Flags: ignoreversion
Source: "..\dist\windows\Pomodoro.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\app\icon.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\app\icon.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
