Pod::Spec.new do |s|
  s.name           = 'MVlc'
  s.version        = '1.0.0'
  s.summary        = 'VLC-based video view for M (MobileVLCKit, LGPL-2.1)'
  s.author         = 'za7ef'
  s.homepage       = 'https://github.com/za7ef/m-app'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.dependency 'MobileVLCKit', '~> 3.6.0'
  s.source_files   = '*.swift'
end
