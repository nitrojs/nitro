'use strict';

module.exports = function (nitro, list, options) {

  var plugins = [],
      _ = require('nitro-tools'),
      color = require('../../color');

  if( options.groupmedia ) {
    var groupmedia = nitro.require('group-css-media-queries');

    list = list.clone().each(function (f) {
      f.src = groupmedia( '' + f.src );
    });
  }

  if( options.autoprefix ) {
    (function () {
      var autoprefixer_options = require('./autoprefixer-options')( options.autoprefix === true ? {} : options.autoprefix ),
          autoprefixer_plugin = nitro.require('autoprefixer')(autoprefixer_options);

      plugins.push(autoprefixer_plugin);

      if( options.autoprefix.show_log ) {
        console.log(color.yellow('autoprefixer.options\n'), autoprefixer_options );
        console.log(color.yellow('autoprefixer.info\n'), autoprefixer_plugin.info() );
      }
    })();
  }

  if( options.minify ) {
    plugins.push( nitro.require('cssnano')( _.extend({
      autoprefixer: false,
      mergeIdents: false,
      reduceIdents: false,
      zindex: false
    }, options.minify === true ? {} : options.minify) ) );
  }

  if( plugins.length ) {
    list = list.process('postcss', { plugins: plugins, sourceMap: options.sourceMap });
  }

  return list;

};
