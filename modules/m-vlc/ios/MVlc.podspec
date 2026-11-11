Pod::Spec.new do |s|
  s.name           = 'MVlc'
  s.version        = '1.1.0'
  s.summary        = 'Lazily loaded VLC video view for M (MobileVLCKit via dlopen, LGPL-2.1)'
  s.author         = 'za7ef'
  s.homepage       = 'https://github.com/za7ef/m-app'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  # No link-time dependency on MobileVLCKit: the framework is only embedded (plugins/withVlcEmbed.js)
  # and opened with dlopen when a VLC source is played, so it can never stop the app from launching.
  s.source_files   = '*.swift'
end
