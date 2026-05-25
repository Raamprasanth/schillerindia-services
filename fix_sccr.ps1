$file = "c:\Users\Raamprasanth\OneDrive\Desktop\shcl\frontend\public\sccr.html"
$bytes = [System.IO.File]::ReadAllBytes($file)
$content = [System.Text.Encoding]::UTF8.GetString($bytes)

# Remove entire Spares nav section (nav-sec + 2 links)
$pattern = '(?s)\s*<div class="nav-sec">Spares</div>\s*<a class="nav-item"[^>]*href="sc-spares-request\.html"[^>]*>.*?</a>\s*<a class="nav-item"[^>]*href="sc-spares-completed\.html"[^>]*>.*?</a>'
$content = [regex]::Replace($content, $pattern, '')

# Fix corrupted emoji icons while we're at it
$content = $content -replace '(<a class="nav-item" href="scprfob\.html"><span class="ico">)[^<]*(</span>)', '${1}&#128203;${2}'
$content = $content -replace '(<a class="nav-item active" href="sccr\.html"><span class="ico">)[^<]*(</span>)', '${1}&#128274;${2}'
$content = $content -replace '(<a class="nav-item active" href="sc-dashboard\.html"><span class="ico">)[^<]*(</span>)', '${1}&#128202;${2}'
$content = $content -replace '(<a class="nav-item" href="sc-dashboard\.html"><span class="ico">)[^<]*(</span>)', '${1}&#128202;${2}'

# Write back as UTF-8 without BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($file, $content, $utf8NoBom)

Write-Host "Done! Removed spares nav and fixed icons in sccr.html"
