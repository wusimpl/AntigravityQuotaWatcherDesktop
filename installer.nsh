!macro customInstallDir
  ; 自动在用户选择的目录后追加应用名称
  StrCpy $INSTDIR "$INSTDIR\AG-Quota-Watcher-Desktop"
!macroend

!macro preInit
  SetRegView 64
  ; 默认安装到 Program Files
  StrCpy $INSTDIR "$PROGRAMFILES64\AG-Quota-Watcher-Desktop"
!macroend
