//     controls.navbar.js Boostrap-compatible navigation bar
//     control (c) 2013 vadim b. http://aplib.github.io/markdown-site-template
//     license: MIT

(function() { "use strict";

    var controls = $ENV.controls;

    function NavBar(parameters, attributes) {
        
        this.initialize('controls.navbar', parameters, attributes, nav_template, $ENV.default_inner_template)
            .class('navbar navbar-default');

        // text contains two parts separated by '***', first part non togglable, second part is togglable
        var parts = (this.text() || '').split(/^\*\*\*/m);
        this.text('');

        // Brand part
        
        this.add('header:div`navbar-header')
            .template(function(it) {
return '<div' + it.printAttributes() + '>\
<button type="button" class="navbar-toggle" data-toggle="collapse" data-target=".navbar-ex1-collapse">\
<span class="sr-only">Toggle navigation</span>\
<span class="icon-bar"></span><span class="icon-bar"></span><span class="icon-bar"></span></button>'
+ $ENV.marked( (it.attributes.$text || "") + it.controls.map(function(control) { return control.wrappedHTML(); }).join("") )
.replace(/<a href/ig, '<a class="navbar-brand" href')
+ '</div>'; 
        });
        if (parts.length > 1)
            $DOC.processContent(this.header, parts[0]);
        
        // Collapsible part
        
        this.add('collapse:div`collapse navbar-collapse navbar-ex1-collapse')
            .template($ENV.default_template, $ENV.default_inner_template);
        $DOC.processContent(this.collapse, parts.slice(-1)[0]);
        
        this.applyPatches = function() {
            var element = this._element;
            if (element) {
                var $e = $(element);
                $e.find('.navbar-collapse > ul').addClass('nav navbar-nav');
                
                var $dm = $e.find('ul ul');
                $dm.addClass('dropdown-menu');
                var $d = $dm.parent();
                $d.addClass('dropdown');
                var toggle = $d.find('> a');
                if (toggle.length) {
                    toggle.addClass('dropdown-toggle');
                    toggle.attr('data-toggle', 'dropdown');
                    toggle.attr('href', '#');
                    if (toggle.html().indexOf('<b class="caret"></b>') <= 0)
                        toggle.append('<b class="caret"></b>');

                    // activate menu item of the current page
                    var loc = window.location.href.toLowerCase();
                    $e.find('ul li a').each(function(i,a) {
                        var href = (a.href || '').toLowerCase();
                        if (href === loc || loc.split(href).concat(href.split(loc)).some(function(frag){return frag && ('index.htm,index.html'.indexOf(frag) >= 0); }))
                            $(a).parents('li').addClass('active');
                    });
                }
            }
        };
        
        this.listen('element', function() {
            this.applyPatches();
        });
    };
    NavBar.prototype = controls.control_prototype;
    function nav_template(it) {
        return '<nav' + it.printAttributes() + '>' + $ENV.marked( (it.attributes.$text || "") + it.controls.map(function(control) { return control.wrappedHTML(); }).join("") ) + '</nav>';
    };
    controls.typeRegister('controls.navbar', NavBar);


})();
