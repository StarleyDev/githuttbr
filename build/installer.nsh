; GitHuttBr's additions to electron-builder's NSIS installer (build.nsis.include).
;
; Up to 4.58 the app shipped with appId com.gitcito.desktop, the identity it
; inherited from Gitcito. electron-builder derives the Windows uninstall GUID
; from the appId, so the move to com.huttbr.git gives the installer a new GUID
; and its own "remove the previous version" step no longer sees the old
; install. Left alone, an upgrade would leave two GitHuttBr entries side by
; side. This takes the old one out, before any new file is written.
;
; The old GUID is also the one a real Gitcito install uses, so the entry is
; removed only when its DisplayName says it is GitHuttBr ("GitHuttBr 4.58.0",
; or "Git HuttBr 4.38.0" from the builds before the 4.39 rename). An entry named
; Gitcito, or anything else, is never touched.
;
; The same script runs for a manual install and for the auto-updater, which
; starts this installer with /S --updated.

; electron-builder: UUID.v5(appId, "50e065bc-3134-11e6-9bab-38c9862bdaf3")
; (app-builder-lib/out/targets/nsis/NsisTarget.js, ELECTRON_BUILDER_NS_UUID),
; computed for the old appId "com.gitcito.desktop". test/nsisUpgrade.test.ts
; recomputes it with the installed electron-builder.
!define GITHUTTBR_OLD_GUID "2e01bc5f-df2b-5b7a-af33-faa365521d92"
!define GITHUTTBR_OLD_UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${GITHUTTBR_OLD_GUID}"
!define GITHUTTBR_OLD_INSTALL_KEY "Software\${GITHUTTBR_OLD_GUID}"

; Run the old install's uninstaller, silently, when ROOT holds a GitHuttBr
; entry under the old GUID, and wait for it. --updated and /KEEP_APP_DATA keep
; %APPDATA%\GitHuttBr (settings, encrypted tokens): electron-builder's
; uninstaller deletes app data only with --delete-app-data or when built with
; deleteAppDataOnUninstall, which this project never sets. A failure is only
; logged: the new install still goes ahead, and the old entry stays for the
; user to remove from Settings > Apps.
!macro githuttbrRemoveOldInstall ROOT MODE_FLAG
  Push $R6
  Push $R7
  Push $R8
  Push $R9
  ReadRegStr $R6 ${ROOT} "${GITHUTTBR_OLD_UNINSTALL_KEY}" DisplayName
  StrCpy $R7 $R6 9
  StrCpy $R8 $R6 10
  ${If} $R7 == "GitHuttBr"
  ${OrIf} $R8 == "Git HuttBr"
    ReadRegStr $R7 ${ROOT} "${GITHUTTBR_OLD_UNINSTALL_KEY}" UninstallString
    !insertmacro GetInQuotes $R8 "$R7"
    ${If} $R8 != ""
    ${AndIf} ${FileExists} "$R8"
      ReadRegStr $R9 ${ROOT} "${GITHUTTBR_OLD_INSTALL_KEY}" InstallLocation
      ${If} $R9 == ""
        Push $R8
        Call GetFileParent
        Pop $R9
      ${EndIf}
      DetailPrint "Removing the previous install: $R6"
      ; Run a copy, as electron-builder does: the uninstaller deletes its own
      ; directory. `_?=` keeps it in this process, so ExecWait really waits.
      !insertmacro copyFile "$R8" "$PLUGINSDIR\old-githuttbr-uninstaller.exe"
      ClearErrors
      ExecWait '"$PLUGINSDIR\old-githuttbr-uninstaller.exe" /S /KEEP_APP_DATA ${MODE_FLAG} --updated _?=$R9' $R7
      ${If} ${Errors}
        ClearErrors
        ExecWait '"$R8" /S /KEEP_APP_DATA ${MODE_FLAG} --updated _?=$R9' $R7
      ${EndIf}
      ${If} ${Errors}
        DetailPrint "Could not start the previous uninstaller."
        ClearErrors
      ${ElseIf} $R7 != 0
        DetailPrint "The previous uninstaller exited with $R7."
      ${EndIf}
    ${EndIf}
    ; Whatever happened above, the old entry must not outlive this install: it
    ; points at the directory the new files are about to fill, so uninstalling
    ; it later from Settings > Apps would delete the new app. Only its registry
    ; keys go; the files are overwritten by this install anyway.
    ReadRegStr $R7 ${ROOT} "${GITHUTTBR_OLD_UNINSTALL_KEY}" DisplayName
    ${If} $R7 != ""
      DetailPrint "Removing the previous install's leftover entry: $R7"
      DeleteRegKey ${ROOT} "${GITHUTTBR_OLD_UNINSTALL_KEY}"
      DeleteRegKey ${ROOT} "${GITHUTTBR_OLD_INSTALL_KEY}"
    ${EndIf}
  ${EndIf}
  Pop $R9
  Pop $R8
  Pop $R7
  Pop $R6
!macroend

; Defining customUnInstallCheck replaces electron-builder's own check of the
; same-GUID uninstall (installUtil.nsh, handleUninstallResult), so that check is
; repeated first, word for word in effect, and the old-GUID removal follows.
; It runs in the install section, after the user confirmed and before any file
; is copied: the old and new installs share the GitHuttBr directory.
!macro customUnInstallCheck
  ${If} ${Errors}
    DetailPrint `Uninstall was not successful. Not able to launch uninstaller!`
    ClearErrors
  ${ElseIf} $R0 != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "$(uninstallFailed): $R0"
    DetailPrint `Uninstall was not successful. Uninstaller error code: $R0.`
    SetErrorLevel 2
    Quit
  ${EndIf}
  !insertmacro githuttbrRemoveOldInstall HKCU "/currentuser"
  !insertmacro githuttbrRemoveOldInstall HKLM "/allusers"
!macroend
