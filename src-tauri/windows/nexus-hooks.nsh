; Mantener PRODUCTNAME/UNINSTKEY/INSTDIR técnicos permite actualizar TrophyHunter.
; Solo la presentación y los accesos propios de esta instalación cambian de marca.
!macro NexusShortcut PATH
  CreateShortcut "${PATH}" "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\nexus-studio.ico" 0
  !insertmacro SetLnkAppUserModelId "${PATH}"
!macroend

!macro NexusRemoveLegacy PATH
  !insertmacro IsShortcutTarget "${PATH}" "$INSTDIR\${MAINBINARYNAME}.exe"
  Pop $0
  ${If} $0 = 1
    Delete "${PATH}"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "${UNINSTKEY}" "DisplayName" "Nexus Studio"
  WriteRegStr SHCTX "${UNINSTKEY}" "DisplayIcon" "$INSTDIR\nexus-studio.ico"
  ${If} $NoShortcutMode != 1
    !insertmacro NexusShortcut "$SMPROGRAMS\Nexus Studio.lnk"
    !insertmacro NexusShortcut "$DESKTOP\Nexus Studio.lnk"
    !insertmacro NexusRemoveLegacy "$SMPROGRAMS\${PRODUCTNAME}.lnk"
    !insertmacro NexusRemoveLegacy "$DESKTOP\${PRODUCTNAME}.lnk"
    ; La página final no debe recrear el acceso con el nombre técnico.
    StrCpy $NoShortcutMode 1
  ${EndIf}
  ; Mantener el mismo archivo anclado, actualizando solo accesos a este ejecutable.
  !insertmacro IsShortcutTarget "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\TrophyHunter.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
  Pop $0
  ${If} $0 = 1
    !insertmacro NexusShortcut "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\TrophyHunter.lnk"
  ${EndIf}
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  !insertmacro NexusRemoveLegacy "$SMPROGRAMS\Nexus Studio.lnk"
  !insertmacro NexusRemoveLegacy "$DESKTOP\Nexus Studio.lnk"
!macroend
