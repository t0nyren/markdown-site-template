//     markdown-site-template
//     http://aplib.github.io/markdown-site-template/
//     (c) 2013 vadim b.
//     License: MIT
// require marked.js, controls.js, bootstrap.controls.js, doT.js, jquery.js

(function() { "use strict";
    
    if ($DOC.state)
        return;

    // load queued components before user.js
    if (window.defercqueue) {
        var q = window.defercqueue;
        delete window.defercqueue;
        for(var i = 0, c = q.length; i < c; i++)
        try {
            q[i]();
        } catch (e) { console.log(e); }
    }

    // document transformation started after all libraries and user.js is loaded
    $DOC.loadUserJS();
    
    // Stub controls loading dispatcher
    var stubs = {};
    function stubResLoader(stub) {
        // here if stub
        var original__type = stub.parameters['#{__type}'].split('.');
        var stublist = stubs[original__type];
        if (!stublist) {
            stublist = [];
            stubs[original__type] = stublist;
        }
        stublist.push(stub);
        var url = $DOC.components + original__type[0] + '/' + original__type[1] + '/' + original__type[0] + '.' + original__type[1] + '.js';
        // load component asynchronously
        var head = document.head, component_js = $(head).children('script[src*="' + url +'"]:first')[0];
        if (!component_js) {
            var component_js = controls.extend(document.createElement('script'), {src:url, async:true});
            component_js.addEventListener('load', function() { stubs[original__type].forEach(function(stub){ stub.state = 1; }); stubs[original__type] = []; });
            component_js.addEventListener('error', function() { stubs[original__type].forEach(function(stub){ stub.state = -1; }); stubs[original__type] = []; });
            head.appendChild(component_js);
        }
    }
    
    // Add text fragment to controls tree
    var template = function(it) { return it.getText() + it.controls.map(function(control) { return control.wrappedHTML(); }).join(''); };
    $DOC.addTextContainer = function(control, text) {
        
        // container.outerHTML() returns text as is
        var container = control.add('container', {$text:text});
        
        // if text contains template then compile to getText function
        var pos = text.indexOf('{{');
        if (pos >= 0 && text.indexOf('}}') > pos) {
            container.getText = controls.template(text);
            container.template(template);
        }
    };
    
    // $DOC.components_off - turn off filters and component translation
    $DOC.processContent = function(collection, content) {
        
        if (!content)
            return;
        
        if (this.components_off) {
            this.addTextContainer(collection, content);
            return;
        }
        
        // 1. check substitutions
        var filters = this.filters;
        for(var i in filters) {
            var subst = filters[i];
            content = content.replace(subst.regex, subst);
        }

        // 2. Look for components
        var content = content.split(/(%\S{1,128})((?:#.*)?\([\S\s]*?\)\1)/gm);
        // todo replace \S [^\r\n\t @#\$%\^&\*\!~`\'\"\\|\/\?<>\{\}\[\]\(\)-_=\+]
        // \([^\(\)]*?\) - exclude matching the parts of multiple patterns, error: a()a b()b -> a()b

        var buffered_text = '';
        for(var i = 0, c = content.length; i < c; i++) {
            var frag = content[i];
            if (!frag) continue;
            if (i < c-1 && frag[0] === '%') {
                var next = content[i+1];
                if (next.slice(-frag.length - 1) === ')' + frag) {
            
                    var parpos = next.indexOf('('),
                        params = next.substr(0, parpos),
                        numberpos = params.indexOf('#'),
                        tag = frag.substr(1);

                    if (parpos >= 0 && (!params || numberpos === 0)) {
                        var inner_text = next.substr(parpos + 1, next.length - frag.length - parpos - 2);
                        i++;

                        // lookup control
                        try {
                            // pass inner text to control
                            var control = controls.createOrStub(tag+params, {$text: inner_text});
                            if (control) {
                                // flush buffer
                                if (buffered_text/* && (buffered_text.length > 16 || buffered_text.trim())*/) {
                                    this.addTextContainer(collection, buffered_text);
                                    buffered_text = '';
                                }

                                collection.add(control);

                                // create stub loader
                                if (control.isStub) {
                                    control.listen('control', function(control) {
                                        // raise 'com' event
                                        var com = $DOC.events.component;
                                        if (com)
                                            com.raise(control);
                                    });
                                    new stubResLoader(control);
                                }
                                
                                // raise 'com' event
                                var com = $DOC.events.component;
                                if (com)
                                    com.raise(control);
                            }
                            else
                                collection.add('p', {$text:'&#60;' + tag + '?&#62;'});

                            continue;
                        } catch (e) { console.log(e); } // error?
                    }
                }
            }
            buffered_text += frag;
        }
        
        // flush buffer
        if (buffered_text/* && (buffered_text.length > 16 || buffered_text.trim())*/)
            this.addTextContainer(collection, buffered_text);
    };
    
    $DOC.processTextNode = processTextNode;
    function processTextNode(text_node, value) {
        var sections = $DOC.sections, edit_mode = $OPT.edit_mode;
        
        if (edit_mode) {
            // remove controls if already created for this text_node
            for(var prop in $DOC.sections) {
                var section = $DOC.sections[prop];
                if (typeof section === 'object' && section.deleteAll && section.source_node === text_node) {
                    section.deleteAll();
                }
            }
        }
        
        var control, text = (arguments.length > 1) ? value : text_node.nodeValue, first_char = text[0], body = document.body, section_name;
        if (' \n\t[@$&*#'.indexOf(first_char) < 0) {
            try {
                if (first_char === '%') {
                    // <--%namespace.cid#params( ... )%namespace.cid-->
                    // \1 cid \2 #params \3 content
                    var match = text.match(/^(%(?:[^ \t\n\(]{1,128}\.)?[^ \t\n\(]{1,128})(#[^\t\n\(]{1,512})?\(([\S\s]*)\)\1$/);
                    if (match) {
                        control = controls.createOrStub(match[1].slice(1) + (match[2] || ''), {$text: match[3]});
                    }
                } else if (first_char === '!') {
                    // <!--!sectionname--> - section remover
                    $DOC.removeSection(text.slice(1));
                    var parent = text_node.parentNode;
                    if (parent) parent.removeChild(text_node);
                } else {
                    // <--sectionname...-->
                    var namelen = text.indexOf(' '),
                        eolpos = text.indexOf('\n'),
                        move = text.indexOf('->');
                    if (namelen < 0 && eolpos < 0 && move < 0) {
                        // <--sectionname-->
                        $DOC.sectionPlaceholder(text, text_node);
                        // Do not delete the placeholder!
                    } else if (namelen < 0 && move > 0) {
                        // <--sectionname->newname-->
                        $DOC.sectionMover(text_node, text.slice(0, move), text.slice(move + 2));
                    } else {
                        // <--sectionname ...-->
                        if (eolpos > 0 && (namelen < 0 || eolpos < namelen))
                            namelen = eolpos;
                        if (namelen > 0 && namelen < 128) {
                            section_name = text.slice(0, namelen);
                            var section_value = text.slice(namelen + 1);
                            control = controls.create('div', {class:section_name});
                            control.name = section_name;
                            $DOC.addSection(section_name, control);
                            control.template($ENV.default_template, $ENV.default_inner_template);
                            $DOC.processContent(control, section_value);
                        }
                    }
                }
                if (control) {
                    // insert control element to DOM

                    /* ? if (!control._element) // element exists if placeholder ? */
                    control.createElement(text_node, 2/*before node*/);
                    if (edit_mode === 2/*preview*/) {
                        control.source_node = text_node;
                        control.source_section = section_name;
                    }
                    else {
                        var parent = text_node.parentNode;
                        if (parent) parent.removeChild(text_node);
                    }
                    if (control._element && control._element.parentNode === body)
                        $DOC.cbody.add(control);

                    // create component loader
                    // FIX: (for orphaned control) start loading after DOM element was created
                    if (control.isStub)
                        new stubResLoader(control);
                    
                    $DOC.events.section.raise(section_name, control, text_node);
                }
            } catch (e) { console.log(e); }
        }
    }
    
    // process sections content
    function processSections(process_head, processed_nodes) {
        
        var head = document.head, body = document.body;
        if (!process_head && !body)
            return;
        
        var sections = $DOC.sections, order = $DOC.order;

        // process DOM tree text nodes
        
        var text_nodes = [],
            iterator = document.createNodeIterator(process_head ? head : body, 0x80, null, false),
            text_node = iterator.nextNode();
        while(text_node) {
            if (processed_nodes.indexOf(text_node) < 0) {
                processed_nodes.push(text_node);
                text_nodes.push(text_node);
            }
            text_node = iterator.nextNode();
        }
        
        for(var i = 0, c = text_nodes.length; i < c; i++)
            processTextNode(text_nodes[i]);
        
        if (process_head)
            return;
        
        // check body
        var cbody = $DOC.cbody;
        if (!cbody._element && body)
            cbody.attachAll();
        if (!cbody._element)
            return;
        
        // process other named sections content, applied from controls or user.js
        
        for(var name in sections)
        if (name) { // skip unnamed for compatibility
            try {
                var placeholder, content = sections[name];
                if (content && content.placeholder) {
                    placeholder = content.placeholder;
                    content = content.content;
                }
                if (typeof content === 'string') {

                    // translate section to control object

                    var section_control = cbody.add('div', {class:name});
                    section_control.name = name;
                    section_control.template($ENV.default_template, $ENV.default_inner_template);
                    $DOC.processContent(section_control, content);

                    // create dom element and place in a definite order
                    
                    var created = false;
                    
                    if (placeholder) {
                        section_control.createElement(placeholder, 2);
                        created = true;
                    } else {
                        var in_order = order.indexOf(name);
                        if (in_order >= 0) {

                            // look element after in order
                            for(var i = in_order + 1, c = order.length; i < c; i++) {
                                var exists_after_in_order = sections[order[i]];
                                if (exists_after_in_order && typeof exists_after_in_order !== 'string') {
                                    // insert before
                                    section_control.createElement(exists_after_in_order.element, 2);
                                    created = true;
                                    break;
                                }
                            }

                            if (!created)
                            // look element before in order
                            for(var i = in_order - 1; i >= 0; i--) {
                                var exists_before_in_order = sections[order[i]];
                                if (exists_before_in_order && typeof exists_before_in_order !== 'string') {
                                    if (exists_before_in_order.source_node) {
                                        // insert after source node
                                        section_control.createElement(exists_before_in_order.source_node, 3);
                                    } else
                                        // insert after
                                        section_control.createElement(exists_before_in_order.element, 3);
                                        created = true;
                                        break;
                                }
                            }
                        }
                    }
                    
                    if (!created)
                        section_control.createElement(document.body, 0);
                    
                    sections[name] = section_control;
                }
            }
            catch (e) { console.log(e); }
        }
    }

    // document transformation started after all libraries and user.js is loaded
    $DOC.finalTransformation = function() {
        if ($DOC.state)
            return;
        
        $DOC.state = 1;
        $DOC.cbody.attach();
        $DOC.listen('section', patches);
        
        var processed_nodes = [];
        
        if ($DOC.auto) {
            
            // html
            
            var timer = setInterval(function() { onresize(); }, 25);
            
            $DOC.onready(function() {
                $DOC.cbody.attachAll();
                onresize();
                $(window).on('resize', onresize);
            });
            
            var onwindowload = function() {
                window.removeEventListener('load', onwindowload);
                if ($DOC.state > 1)
                    return;
                $DOC.state = 2;
                
                clearInterval(timer); // off timer after css loaded
                
                // raise 'load' event
                var load_event = $DOC.forceEvent('load');
                load_event.raise();
                load_event.clear();

                onresize(); // before and after 'load' event
                setTimeout(onresize, 200); // resized after css applying
            };
            
            // be sure to call
            if (document.readyState === 'complete')
                onwindowload();
            else
                window.addEventListener('load', onwindowload);
            
        } else if ($OPT.edit_mode !== 1 /*page not processed in edit mode*/) {
            
            // page transformation
            
            // delay first transformation -> timer
            var timer = setInterval(function() {
                processSections(false, processed_nodes); // sections may be inserted by components
                onresize();
            }, 25);
            
            $DOC.onready(function() {
                processSections(true, processed_nodes);
                processSections(false, processed_nodes);
                onresize();
                $(window).on('resize', onresize);
            });
            
            var onwindowload = function() {
                
                window.removeEventListener('load', onwindowload);
                clearInterval(timer); // off timer after css loaded
                
                if ($DOC.state > 1)
                    return;
                
                processSections(false, processed_nodes);
                
                $DOC.state = 2;
                
                // scroll to hash element
                // scroll down if fixtop cover element
                if (window.location.hash) {
                    window.location = window.location;
                    var pad = parseInt(window.getComputedStyle(document.body).paddingTop);
                    if (pad)
                        window.scrollBy(0, -pad);
                }
                
                // raise 'load' event
                var load_event = $DOC.forceEvent('load');
                load_event.raise();
                load_event.clear();

                onresize(); // before and after 'load' event
                setTimeout(onresize, 200); // resized after css applying
            };
            
            // be sure to call
            if (document.readyState === 'complete')
                onwindowload();
            else
                window.addEventListener('load', onwindowload);
        } else {
            // raise 'load' event
            var load_event = $DOC.forceEvent('load');
            load_event.raise();
            load_event.clear();
        }
    };

    
    // Patches
    
    // apply js patches for dom elements on transformation progress
    
    function patches(name, control, source_node) {
        if (control) {
            var element = control.element;
            if (element)
                $(element).find('table').addClass('table table-bordered table-stripped');
            else
                for(var prop in control.controls)
                    $(control.controls[prop].element).find('table').addClass('table table-bordered table-stripped');
        }
    }
    
    // fired on 1. dom manipulation 2. css loading in progress can size effects 3. window resize after page loaded
    
    function onresize() {
        // body padding
        var top = 0, right = 0, bottom = 0, left = 0;
        function calc(classname, prop) {
            var el = document.querySelector(classname);
            return (el) ? el[prop] : 0;
        }
        top += calc('.fixed-top-bar', 'clientHeight');
        top += calc('.fixed-top-panel', 'clientHeight');
        right += calc('.fixed-right-side-bar', 'clientWidth');
        right += calc('.fixed-right-side-panel', 'clientWidth');
        bottom += calc('.fixed-bottom-bar', 'clientHeight');
        bottom += calc('.fixed-bottom-panel', 'clientHeight');
        left += calc('.fixed-left-side-bar', 'clientWidth');
        left += calc('.fixed-left-side-panel', 'clientWidth');
        
        $DOC.appendCSS('document#onresize', 'body{padding: ' + top + 'px ' + right + 'px ' + bottom + 'px ' + left + 'px;}');
    }
    
    
    // check for start document transformation
    $DOC.onready($DOC.checkAllScriptsReady.bind($DOC));
})();
