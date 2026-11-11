Pod::Spec.new do |s|
  s.name           = 'MTorrent'
  s.version        = '1.0.0'
  s.summary        = 'M built-in torrent streaming engine'
  s.author         = 'za7ef'
  s.homepage       = 'https://github.com/za7ef/m-app'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files   = '*.swift'
  s.vendored_frameworks = 'Mtorrent.xcframework'
  s.frameworks     = 'Security', 'SystemConfiguration'
  s.libraries      = 'resolv'
end
