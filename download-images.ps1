$ErrorActionPreference = "Stop"

$imageFolder = Join-Path $PSScriptRoot "images"

if (-not (Test-Path $imageFolder)) {
    New-Item -ItemType Directory -Path $imageFolder | Out-Null
}

$images = @{

    "home-hero.jpg" =
        "https://commons.wikimedia.org/wiki/Special:Redirect/file/Nepal_village_life.jpg"

    "home-intro.jpg" =
        "https://commons.wikimedia.org/wiki/Special:Redirect/file/Durbar_High_School_%2842199%29.jpg"

    "education.jpg" =
        "https://commons.wikimedia.org/wiki/Special:Redirect/file/Jesuit_education_%28at_Kathmandu%2C_Nepal%29.JPG"

    "community.jpg" =
        "https://commons.wikimedia.org/wiki/Special:Redirect/file/Grand_newa_conference1.jpg"

    "village.jpg" =
        "https://commons.wikimedia.org/wiki/Special:Redirect/file/A_view_of_Jorsale_village_in_Nepal%2C_photographed_on_November_25%2C_2023.jpg"

    "support.jpg" =
        "https://commons.wikimedia.org/wiki/Special:Redirect/file/Phulbari%2C_Nepal.jpg"
}

foreach ($image in $images.GetEnumerator()) {

    $destination =
        Join-Path $imageFolder $image.Key

    Write-Host ""
    Write-Host "Downloading $($image.Key)..." -ForegroundColor Cyan

    Invoke-WebRequest `
        -Uri $image.Value `
        -OutFile $destination

    Write-Host "Saved: $destination" -ForegroundColor Green
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host " ASF FOUNDATION IMAGES READY" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Images saved inside:"
Write-Host $imageFolder