Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap(1024,1024)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::FromArgb(59,130,246))
$font = New-Object System.Drawing.Font('Arial',300,[System.Drawing.FontStyle]::Bold)
$brush = [System.Drawing.Brushes]::White
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = 'Center'
$sf.LineAlignment = 'Center'
$rect = New-Object System.Drawing.RectangleF(0,0,1024,1024)
$g.DrawString('T',$font,$brush,$rect,$sf)
$bmp.Save('D:\claudeManage\townui\app-icon.png',[System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Host "app-icon.png created!"
