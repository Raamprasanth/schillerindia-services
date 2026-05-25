$file = "c:\Users\Raamprasanth\OneDrive\Desktop\shcl\frontend\public\employee-dashboard.html"

# Read the file as raw bytes and convert to string using UTF-8
$bytes = [System.IO.File]::ReadAllBytes($file)
$content = [System.Text.Encoding]::UTF8.GetString($bytes)

# Replace corrupted emoji placeholders with HTML entities in nav items
# Dashboard
$content = $content -replace '(<a class="nav-item active" href="employee-dashboard\.html"><span class="ico">)[^<]*(</span> Dashboard</a>)', '${1}&#128202;${2}'
# Services
$content = $content -replace '(<a class="nav-item" href="employee-service-list\.html"><span class="ico">)[^<]*(</span> Services</a>)', '${1}&#128295;${2}'
# Pending FRN
$content = $content -replace '(<a class="nav-item" href="emppendingfrn\.html"><span class="ico">)[^<]*(</span> Pending FRN</a>)', '${1}&#128203;${2}'
# Estimation Pending
$content = $content -replace '(<a class="nav-item" href="employee-ob-pending\.html"><span class="ico">)[^<]*(</span> Estimation Pending</a>)', '${1}&#128230;${2}'
# SO Pending
$content = $content -replace '(<a class="nav-item" href="empestpend\.html"><span class="ico">)[^<]*(</span> SO Pending</a>)', '${1}&#128203;${2}'
# Under Repair
$content = $content -replace '(<a class="nav-item" href="empunderep\.html"><span class="ico">)[^<]*(</span> Under Repair</a>)', '${1}&#128736;${2}'
# Completed FRN
$content = $content -replace '(<a class="nav-item" href="completed-frn\.html"><span class="ico">)[^<]*(</span> Completed FRN</a>)', '${1}&#9989;${2}'
# Supplier Warranty
$content = $content -replace '(<a class="nav-item" href="Emp-scrap-list\.html"><span class="ico">)[^<]*(</span> Supplier Warranty</a>)', '${1}&#9888;${2}'
# External Repair
$content = $content -replace '(<a class="nav-item" href="sc-completed-frn\.html"><span class="ico">)[^<]*(</span> External Repair</a>)', '${1}&#128260;${2}'
# Call Register
$content = $content -replace '(<a class="nav-item" href="ecall\.html"><span class="ico">)[^<]*(</span> Call Register</a>)', '${1}&#128222;${2}'
# Closed Calls
$content = $content -replace '(<a class="nav-item" href="eclose\.html"><span class="ico">)[^<]*(</span> Closed Calls</a>)', '${1}&#9989;${2}'
# Pending Activity
$content = $content -replace '(<a class="nav-item" href="emp-pending-activity\.html"><span class="ico">)[^<]*(</span> Pending Activity</a>)', '${1}&#128340;${2}'
# Closed Activity
$content = $content -replace '(<a class="nav-item" href="emp-closed-activity\.html"><span class="ico">)[^<]*(</span> Closed Activity</a>)', '${1}&#9989;${2}'
# PRF/OB Register
$content = $content -replace '(<a class="nav-item" href="eprfob\.html"><span class="ico">)[^<]*(</span> PRF/OB Register</a>)', '${1}&#128203;${2}'
# Closed PRF/OB Register
$content = $content -replace '(<a class="nav-item" href="ecr\.html"><span class="ico">)[^<]*(</span> Closed PRF/OB Register</a>)', '${1}&#128274;${2}'
# Non Saleable
$content = $content -replace '(<a class="nav-item" href="emp-non-saleable\.html"><span class="ico">)[^<]*(</span> Non Saleable</a>)', '${1}&#128230;${2}'
# Saleables
$content = $content -replace '(<a class="nav-item" href="emp-saleables\.html"><span class="ico">)[^<]*(</span> Saleables</a>)', '${1}&#128176;${2}'
# BIR LIST
$content = $content -replace '(<a class="nav-item" href="emp-bir-list\.html"><span class="ico">)[^<]*(</span> BIR LIST</a>)', '${1}&#128203;${2}'
# Closed BIR
$content = $content -replace '(<a class="nav-item" href="emp-closed-bir\.html"><span class="ico">)[^<]*(</span> Closed BIR</a>)', '${1}&#9989;${2}'
# Spares_List
$content = $content -replace '(<a class="nav-item" href="emp-spares-list\.html"><span class="ico">)[^<]*(</span> Spares_List</a>)', '${1}&#128295;${2}'
# Spares_List_Completed
$content = $content -replace '(<a class="nav-item" href="emp-spares-completed\.html"><span class="ico">)[^<]*(</span> Spares_List_Completed</a>)', '${1}&#9989;${2}'

# Write back as UTF-8 without BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($file, $content, $utf8NoBom)

Write-Host "Done! All nav icons replaced with HTML entities."
