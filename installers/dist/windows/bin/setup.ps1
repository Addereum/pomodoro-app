# ==============================================================================
# Pomodoro App - Modern Windows Graphical Installer (WPF / XAML)
# ==============================================================================

Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName System.Windows.Forms
$ErrorActionPreference = "SilentlyContinue"

$SourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path "$SourceDir\app\web\index.html")) {
    $SourceDir = Split-Path -Parent $SourceDir
}

$DefaultInstallPath = "$env:LOCALAPPDATA\Programs\PomodoroApp"

[xml]$xaml = @"
<Window
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    Title="Addereums Pomodoro Installation" Height="480" Width="580"
    WindowStartupLocation="CenterScreen" ResizeMode="NoResize"
    Background="#1e1e1e" Foreground="#f5f5f7" FontFamily="Segoe UI">
    <Window.Resources>
        <Style TargetType="Button">
            <Setter Property="Background" Value="#e03131"/>
            <Setter Property="Foreground" Value="White"/>
            <Setter Property="FontWeight" Value="SemiBold"/>
            <Setter Property="FontSize" Value="14"/>
            <Setter Property="Padding" Value="14,8"/>
            <Setter Property="BorderThickness" Value="0"/>
            <Setter Property="Cursor" Value="Hand"/>
            <Setter Property="Template">
                <Setter.Value>
                    <ControlTemplate TargetType="Button">
                        <Border Background="{TemplateBinding Background}" CornerRadius="6" Padding="{TemplateBinding Padding}">
                            <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
                        </Border>
                    </ControlTemplate>
                </Setter.Value>
            </Setter>
        </Style>
        <Style TargetType="CheckBox">
            <Setter Property="Foreground" Value="#d0d0d5"/>
            <Setter Property="FontSize" Value="13"/>
            <Setter Property="Margin" Value="0,4"/>
        </Style>
    </Window.Resources>

    <Grid Margin="28">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
            <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>

        <!-- Header -->
        <StackPanel Grid.Row="0" Margin="0,0,0,20">
            <TextBlock Text="🍅 Addereums Pomodoro" FontSize="24" FontWeight="Bold" Foreground="#ffffff"/>
            <TextBlock Text="Fokus- &amp; Produktivitäts-Timer | https://github.com/addereum/pomodoro-app" FontSize="12" Foreground="#a0a0a5" Margin="0,4,0,0"/>
        </StackPanel>

        <!-- Main Body -->
        <Border Grid.Row="1" Background="#282828" CornerRadius="12" Padding="20" BorderBrush="#383838" BorderThickness="1">
            <StackPanel>
                <TextBlock Text="Installationsziel:" FontSize="13" FontWeight="SemiBold" Foreground="#f5f5f7"/>
                <Grid Margin="0,8,0,16">
                    <Grid.ColumnDefinitions>
                        <ColumnDefinition Width="*"/>
                        <ColumnDefinition Width="Auto"/>
                    </Grid.ColumnDefinitions>
                    <TextBox Name="txtPath" Grid.Column="0" Text="$DefaultInstallPath" Background="#1e1e1e" Foreground="#ffffff" BorderBrush="#404040" Padding="8,6" FontSize="12" VerticalContentAlignment="Center"/>
                    <Button Name="btnBrowse" Grid.Column="1" Content="Durchsuchen..." Margin="8,0,0,0" Padding="10,6" Background="#383838" FontSize="12"/>
                </Grid>

                <TextBlock Text="Optionen:" FontSize="13" FontWeight="SemiBold" Foreground="#f5f5f7" Margin="0,4,0,6"/>
                <CheckBox Name="chkDesktop" Content="Desktop-Verknüpfung erstellen" IsChecked="True"/>
                <CheckBox Name="chkStartMenu" Content="Startmenü-Verknüpfung erstellen" IsChecked="True"/>
                <CheckBox Name="chkLaunch" Content="Pomodoro nach der Installation sofort starten" IsChecked="True"/>

                <ProgressBar Name="prgBar" Height="8" Margin="0,18,0,0" Visibility="Hidden" IsIndeterminate="True" Foreground="#e03131" Background="#383838"/>
                <TextBlock Name="txtStatus" Text="Bereit zur Installation." FontSize="12" Foreground="#888888" Margin="0,6,0,0" HorizontalAlignment="Center"/>
            </StackPanel>
        </Border>

        <!-- Footer Actions -->
        <Grid Grid.Row="2" Margin="0,18,0,0">
            <Button Name="btnCancel" Content="Abbrechen" HorizontalAlignment="Left" Background="#383838" Width="110"/>
            <Button Name="btnInstall" Content="Jetzt Installieren" HorizontalAlignment="Right" Width="160"/>
        </Grid>
    </Grid>
</Window>
"@

$reader = (New-Object System.Xml.XmlNodeReader $xaml)
$window = [Windows.Markup.XamlReader]::Load($reader)

# Get Controls
$txtPath = $window.FindName("txtPath")
$btnBrowse = $window.FindName("btnBrowse")
$chkDesktop = $window.FindName("chkDesktop")
$chkStartMenu = $window.FindName("chkStartMenu")
$chkLaunch = $window.FindName("chkLaunch")
$prgBar = $window.FindName("prgBar")
$txtStatus = $window.FindName("txtStatus")
$btnCancel = $window.FindName("btnCancel")
$btnInstall = $window.FindName("btnInstall")

$txtPath.Text = $DefaultInstallPath

$btnBrowse.Add_Click({
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.SelectedPath = $txtPath.Text
    $dialog.Description = "Wähle das Installationsverzeichnis für Pomodoro:"
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        $txtPath.Text = $dialog.SelectedPath
    }
})

$btnCancel.Add_Click({
    $window.Close()
})

$btnInstall.Add_Click({
    $btnInstall.IsEnabled = $false
    $btnBrowse.IsEnabled = $false
    $prgBar.Visibility = "Visible"
    $txtStatus.Text = "Kopiere Dateien..."

    $TargetDir = $txtPath.Text

    try {
        if (-not (Test-Path $TargetDir)) {
            New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
        }

        # Copy App
        Copy-Item -Path "$SourceDir\app" -Destination $TargetDir -Recurse -Force
        Copy-Item -Path "$SourceDir\bin" -Destination $TargetDir -Recurse -Force
        Copy-Item -Path "$SourceDir\Pomodoro.exe" -Destination $TargetDir -Force
        Copy-Item -Path "$SourceDir\Uninstall.exe" -Destination $TargetDir -Force

        $WshShell = New-Object -ComObject WScript.Shell
        $ExeTarget = "$TargetDir\Pomodoro.exe"
        $IconTarget = "$TargetDir\app\icon.ico"

        # Desktop Shortcut
        if ($chkDesktop.IsChecked) {
            $DesktopDir = [System.Environment]::GetFolderPath("Desktop")
            $Shortcut = $WshShell.CreateShortcut("$DesktopDir\Pomodoro.lnk")
            $Shortcut.TargetPath = $ExeTarget
            $Shortcut.WorkingDirectory = $TargetDir
            $Shortcut.IconLocation = "$IconTarget, 0"
            $Shortcut.Description = "Pomodoro - Fokus & Produktivitäts-Timer"
            $Shortcut.Save()
        }

        # Start Menu Shortcut
        if ($chkStartMenu.IsChecked) {
            $StartMenuDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"
            $Shortcut = $WshShell.CreateShortcut("$StartMenuDir\Pomodoro.lnk")
            $Shortcut.TargetPath = $ExeTarget
            $Shortcut.WorkingDirectory = $TargetDir
            $Shortcut.IconLocation = "$IconTarget, 0"
            $Shortcut.Description = "Pomodoro - Fokus & Produktivitäts-Timer"
            $Shortcut.Save()
        }

        # Register in Windows Apps & Features (Uninstall)
        $UninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\AddereumsPomodoro"
        New-Item -Path $UninstallKey -Force | Out-Null
        Set-ItemProperty -Path $UninstallKey -Name "DisplayName" -Value "Addereums Pomodoro"
        Set-ItemProperty -Path $UninstallKey -Name "DisplayVersion" -Value "1.0.0"
        Set-ItemProperty -Path $UninstallKey -Name "Publisher" -Value "addereum"
        Set-ItemProperty -Path $UninstallKey -Name "HelpLink" -Value "https://github.com/addereum/pomodoro-app"
        Set-ItemProperty -Path $UninstallKey -Name "DisplayIcon" -Value "$IconTarget"
        Set-ItemProperty -Path $UninstallKey -Name "UninstallString" -Value "`"$TargetDir\Uninstall.exe`""
        Set-ItemProperty -Path $UninstallKey -Name "InstallLocation" -Value "$TargetDir"

        $txtStatus.Text = "Installation erfolgreich abgeschlossen!"
        $prgBar.Visibility = "Hidden"

        if ($chkLaunch.IsChecked) {
            Start-Process -FilePath $ExeTarget -WorkingDirectory $TargetDir
        }

        $window.Close()
    } catch {
        [System.Windows.Forms.MessageBox]::Show("Fehler bei der Installation: $_", "Fehler", 0, 16)
        $btnInstall.IsEnabled = $true
        $prgBar.Visibility = "Hidden"
        $txtStatus.Text = "Fehler aufgetreten."
    }
})

$window.ShowDialog() | Out-Null
