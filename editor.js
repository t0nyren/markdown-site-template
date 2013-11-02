//     editor.js
//     http://aplib.github.io/markdown-site-template/
//     (c) 2013 vadim b.
//     License: MIT

(function() { "use strict";
    var db, controller, table, toolbar, tabheaders, options, code_edit, parser, preview;
    
    if (typeof $ENV !== 'undefined') initialize(); else { if (!this.defercqueue) this.defercqueue = []; this.defercqueue.push(initialize); }

    function initialize() {
        
        $(window).load(function() {
            controls.typeRegister('editor.utilites', Utilities);
            db = new DB(location.origin + location.pathname, openEditor);
        });
        
        function openEditor() {
            
            $DOC.cbody.attachAll();
            $DOC.appendCSS('document.editor.css', '.tooltip, .popover { z-index:1200; }');
            
            // parser-builder
            parser = new Parser();
            
            // preview
            $DOC.cbody.add(preview = new Preview());
            preview.createElement();
            
            // toolbar
            
            table = $DOC.cbody.add('div', {style:'overflow:hidden; border-radius:4px; position:fixed; top:20px;bottom:20px;right:20px; width:50%; z-index:1101; border: silver solid 1px; background-color:white;'});
            toolbar = table.add('toolbar:div', {class:'clearfix', style:'z-index:1111; background-color:#f0f0f0; line-height:32px; padding:0;'});
            toolbar.listen('element', function(element) {
                if (element)
                    $(element).find('button,li,a').tooltip({placement:'bottom', container:'body', toggle:'tooltip'});
            });
            
            // buttons
            
            toolbar.add('save_group:bootstrap.BtnGroup', {class:'mar5'}, function(save_group) {
                //toolbar.save_group.add('download:bootstrap.Button', {$icon:'font',      'data-original-title':'Formatting toolbar'});
                save_group.add('revert:bootstrap.Button',   {$icon:'backward',  'data-original-title':'Revert'})
                    .listen('click', function() {
                        controller.revert();
                    });
                save_group.add('save:a', {class:'btn btn-default', $text:'<b class="glyphicon glyphicon-save"></b>', 'data-original-title':'Download edited document'})
                    .listen('click', function() {
                        this.element.href = 'data:application/octet-stream;charset=utf-8,' + encodeURIComponent(controller.buildHTML());
                        this.element.download = location.pathname.split('/').slice(-1)[0] || 'document.html';
                    });
            });
            
            toolbar.add('controls_group:bootstrap.BtnGroup', {class:'mar5 fright'}, function(controls_group) {
                controls_group.add('bootstrap.Button', {$icon:'th-large', 'data-original-title':'Window managing'});
                controls_group.add('bootstrap.Button', {$icon:'remove', 'data-original-title':'Close editor'})
                    .listen('click', function() {
                        window.location = window.location.origin + window.location.pathname;
                    });
            });
            
            // tabheaders
            
            toolbar.add(tabheaders = new TabHeaders());
            tabheaders.data.push({text:'', hint:'Page options', icon:'check'}, {text:'HTML', hint:'Edit as HTML'});
            
            // code edit

            table.add(code_edit = new CodeEditor());
            table.add(options = new Options());
            
            // create form
            table.createElement();
            
            
            // app controller
            controller = new function() {
                var source_html;
                
                parser.listen(function() {
                    
                    controller.edit_html = parser.html;
                    
                    // update tabheaders
                    var keys = Object.keys(parser.sections),
                        data = tabheaders.data;
                    data.length = 2 + keys.length;
                    for(var i = 0, c = keys.length; i < c; i++)
                        data[i + 2] = {text:keys[i]};
                    data.raise();
                    
                    // update preview
                    preview.updateInnerHtml(parser.chtml.innerHTML(), Object.keys(parser.sections));
                });
                
                // edited html
                var edit_html;
                Object.defineProperty(this, 'edit_html',
                {
                    get: function() { return edit_html; },
                    set: function(value) {
                        if (value !== edit_html) {
                            edit_html = value;
                            parser.html = edit_html;
                        }
                    }
                });
                
                function activity() {
                    if (controller.modified)
                        controller.modified = 25;
                }
                
                // On tab header selected
                tabheaders.listen('selected', function() {
                    // check unsaved changes
                    code_edit.save();
                    // update code_edit
                    controller.updateCodeEdit();
                    controller.modified = 5;
                    options.visible = (tabheaders.selectedIndex === 0);
                });
                
                this.updateCodeEdit = function() {
                    code_edit.mode = tabheaders.selectedIndex;
                    switch(code_edit.mode) {
                        case 1: // html
                            code_edit.text = controller.edit_html;
                            break;
                        case 2: // sections
                            var selected = tabheaders.selected;
                            if (selected) {
                                // set selected section name and text to edit
                                code_edit.section = selected.text;
                                code_edit.text = parser.sections[selected.text];
                            } else
                                code_edit.text = '';
                            break;
                        default:
                            code_edit.text = '';
                    }
                };
                // On code editor data
                code_edit.listen('text', function(edit_value) {
                    switch(code_edit.mode) {
                        case 1: // html edited
                            controller.edit_html = edit_value;
                            controller.modified = 25;
                            break;
                            
                        case 2: // section code edited
                            controller.updateNamedSection(code_edit.section,  code_edit.text);
                            controller.modified = 25;
                            break;
                    }
                });
                
                // update one section when the text section edited
                this.updateNamedSection = function(name, value) {
                    parser.updateNamedSection(name, value);
                    edit_html = parser.buildHTML();
                    preview.updateNamedSection(name, value, parser.chtml.innerHTML());
                };
                
                // save()
                this.save = function() {
                    var data = db.dataobject.data;
                    
                    data.selected = tabheaders.selected && tabheaders.selected.text;
                    data.html = this.edit_html;
                    if (data.html === source_html)
                        data.delete = true;
                    
                    db.dataobject.raise();
                    
                    this.modified = 0;
                };
                
                   
                // revert()
                this.revert = function() {
                    this.edit_html = source_html;
                    this.updateCodeEdit();
                    this.modified = 2;
                    setTimeout(function() { window.location.reload(); }, 300);
                };
                
                this.buildHTML = function() {
                    code_edit.save();
                    return parser.buildHTML();
                };

                db.restore(function() {
                    var xmlhttp = new XMLHttpRequest();
                    xmlhttp.open('GET', location.href, false);
                    xmlhttp.onload = function(event) {
                        source_html = event.target.response.replace(/\r/g, '');
                        controller.edit_html = db.dataobject.data.html || source_html;
                        tabheaders.selected = db.dataobject.data.selected;
                        tabheaders.checkSelection();
                    };
                    xmlhttp.send();
                });
            };
           
            setInterval(function() {
                if (controller.modified)
                if (--controller.modified < 2) {
                    controller.modified = 0;
                    controller.save();
                }
            }, 25);

        } // onDbReady()
 
    } //initialize()
    
    
    // directly accesses the parser
    function Options() {
        
        var options = controls.create('div', {class:'pad20'});
        
        var visible = true;
        Object.defineProperty(options, 'visible', {
            get: function() { return visible; },
            set: function(value) { visible = value; if (options.element) options.element.style.display = (visible) ? 'block' : 'none'; }
        });
        options.listen('element', function(element) { if (element) element.style.display = (visible) ? 'block' : 'none'; });
        
        var title_grp = options.add('bootstrap.FormGroup');
        title_grp.add('bootstrap.ControlLabel', {$text:'Title:'});
        title_grp.add('title_edit:bootstrap.ControlInput', {value:''})
                .listen('change', function() { parser.title = title_grp.title_edit.value; });
        
        parser.listen(function() {
            if (parser.title !== title_grp.title_edit.value)
                title_grp.title_edit.value = parser.title;
        });
        
        return options;
    }

    function CodeEditor() { // mode, text, section
        
        var code_edit = controls.create('textarea', {class:'form-control', style:'font-family:Consolas,Monaco,Lucida Console,Liberation Mono,DejaVu Sans Mono,Bitstream Vera Sans Mono,Courier New,monospace; display:none; border:0; border-radius:0; border-left:#f9f9f9 solid 6px; box-shadow:none; width:100%; height:100%; resize:none; '});
        function code_edit_resize() {
            code_edit.element.style.height = ($(table.element).height() - $(toolbar.element).height()) + 'px';
        }
        $(window).on('resize', function() {
            code_edit_resize();
        });
        
        var mode = 0; // 0 - options, hide text area, 1 - html, 2 - section
        Object.defineProperty(code_edit, 'mode', {
            get: function() { return mode; },
            set: function(value) {
                if (value > 2)
                    value = 2;
                if (value !== mode) {
                    mode = value;
                    if (this.element)
                        code_edit.element.style.display = (mode) ? 'block' : 'none';
                    code_edit_resize();
                }
            }
        });
        var editvalue;
        code_edit.listen('element', function(element) {
            if (element)
                element.value = editvalue;
            code_edit_resize();
        });
        Object.defineProperty(code_edit, 'text', {
            get: function() { return this.element ? this.element.value : editvalue; },
            set: function(value) {
                editvalue = value || '';
                if (this.element)
                    this.element.value = editvalue;
                this.modified = 0;
            }
        });
        code_edit.save = function() {
            checkChanged();
            if (this.modified) {
                this.modified = 0;
                this.raise('text', editvalue);
            }
        };
        function checkChanged() {
            if (code_edit.mode) {
                var element = code_edit._element;
                if (element && element.value !== editvalue) {
                    code_edit.modified = 25;
                    editvalue = element.value;
                }
            }
        }
        code_edit.listen('change', checkChanged, true);
        
        setInterval(function() {
            checkChanged();
            if (code_edit.modified)
            if (--code_edit.modified < 2) {
                code_edit.modified = 0;
                code_edit.raise('text', editvalue);
            }
        }, 25);
        
        return code_edit;
    }
    
    
    function TabHeaders() {
        // data item { id: text: hint: icon: }
        var selected, selectedIndex, lastSelected;
        
        var tabs_header_control = toolbar.add('tabs_header:bootstrap.TabPanelHeader');
        tabs_header_control.bind(controls.create('dataarray'));
        tabs_header_control.listen('data', function() {
            
            // synchronize controls with data array
            
            var subcontrols = tabs_header_control.controls, data = this.data;
            for(var i = subcontrols.length, c = data.length; i < c; i++)
                tabs_header_control.add('bootstrap.TabHeader')
                    .listen('click', function() {
                        tabs_header_control.selectedIndex = tabs_header_control.controls.indexOf(this);
                    });
                
            for(var i = subcontrols.length - 1, c = data.length; i >= c; i--) {
                var control = subcontrols[i];
                control.deleteAll();
                tabs_header_control.remove(control);
            }
            
            for(var i = 0, c = data.length; i < c; i++) {
                var item = data[i];
                item.id = subcontrols[i].id;
                var control = subcontrols[i];
                control.attributes['data-original-title'] = item.hint;
                control.attributes.$icon = item.icon;
                control.text(item.text);
                if (item === selected)
                    control.class('active');
                else
                    control.class(null, 'active');
            }
            
            tabs_header_control.checkSelection();
            
            if (tabs_header_control.element)
                tabs_header_control.refresh();
        });
        
        // selected
        
        Object.defineProperty(tabs_header_control, 'selectedIndex',
        {
            get: function() { return selectedIndex; },
            set: function(value) { this.selected = value; }
        });
        Object.defineProperty(tabs_header_control, 'selected',
        {
            get: function() { return selected; },
            set: function(value) {
                var data = this.data;

                if (typeof value === 'string') {
                    // by id
                    for(var i = 0, c = data.length; i < c; i++) {
                        var item = data[i];
                        if (item.id === value) {
                            this.selected = item;
                            return;
                        }
                    }
                    // by text
                    for(var i = 0, c = data.length; i < c; i++) {
                        var item = data[i];
                        if (item.text === value) {
                            this.selected = item;
                            return;
                        }
                    }
                    return;
                }
            
                if (typeof value === 'number') {
                    if (value >= 0 && value < data.length && value !== selectedIndex)
                        this.selected = data[value];
                    else if ( value === -1)
                        this.selected = undefined;
                    return;
                }
                
                var index = data.indexOf(value);
                if (index >= 0) {
                    var item = data[index];
                    if (item !== selected)
                        lastSelected = selected;
                }
                if (value !== selected || index !== selectedIndex) {
                    var subcontrols = this.controls;
                    for(var i = 0, c = subcontrols.length; i < c; i++) {
                        if (i === index)
                            subcontrols[i].class('active');
                        else
                            subcontrols[i].class(null, 'active');
                    }
                    this.raise('selected', selected = value ? value : undefined, selectedIndex = index);
                }
            }
        });
        
        tabs_header_control.checkSelection = function() {
            var data = this.data;
            
            if (data.length) {
                if (!selected || selectedIndex < 0 || selectedIndex >= data.length) {
                    this.selected = lastSelected;
                    if (!selected)
                        tabs_header_control.selectedIndex = (!selectedIndex || selectedIndex < 0) ? 0 : data.length - 1;
                }
            } else if (selectedIndex >=0 || selected) {
                this.selected = -1;
            }
        };

        return tabs_header_control;
    }
    
    
    function Preview() {
        var update_inner_html, sections_keys;
        
        var url = location.href;
            url = url.slice(0, url.length - location.hash.length);
            if (url.indexOf('?') > 0)
                url += '&preview';
            else
                url += '?preview';
        
        preview = controls.create('iframe', {sandbox:'', src:url, style:'position:fixed; left:0; top:0; width:100%; height:100%; z-index:1100; border:none;'});
        
        preview.updateInnerHtml = function(inner_html, _sections_keys) {
            update_inner_html = inner_html;
            sections_keys = _sections_keys;

            var doc = this.element && this.element.contentDocument,
                $doc = this.$DOC;
            if (doc && $doc) {
                var html = doc.getElementsByTagName('html')[0];
                if (html) {
                    // full clear $DOC document
                    $doc.chead.detachAll();
                    $doc.chead = null;
                    $doc.cbody.detachAll();
                    $doc.cbody = null;
                    $doc.state = 0;
                    Object.keys($doc.sections).forEach(function(key) { delete $doc.sections[key]; });
                    // update html
                    html.innerHTML = inner_html;
                    // reproduce document
                    $doc.headTransformation();
                    $doc.loadUserJS();
                    setTimeout(function(){
                        $doc.finalTransformation();
                    },0);
                }
            }
        };
        
        preview.reload = function() {
            if (this.element)
                this.deleteAll();
            this.createElement();
        };
        
        preview.listen('load', function() {
            // check if navigated out the current location
            try {
                if (this.element.contentWindow.location.pathname !== window.location.pathname)
                    this.deleteElement();
            } catch (e) {
                this.deleteElement();
            }
            
            this.$DOC = this.element && preview.element.contentWindow.$DOC;
            
            // update html
            if (update_inner_html !== undefined)
                this.updateInnerHtml(update_inner_html, sections_keys);
        });

        preview.updateNamedSection = function(name, text, updated_inner_html) {
            update_inner_html = updated_inner_html;
            var doc = this.$DOC;
            var doc_section = doc.sections[name];
            if (typeof doc_section === 'object' && doc_section.source_node) {
                // ??
//                if (!doc_section.element)
//                    doc_section.attach();
                doc.processTextNode(doc_section.source_node, name + '\n' + text);
            }
        };

        return preview;
    }
    
    
    // Parser and builder. Parse html and create html builder tree.
    // 
    // html - parsed html
    // chtml - html builder root control
    // sections - parsed sections
    // seccontrols - map section name -> builder node
    function Parser() {
        var html;
        
        // >> key elements
        var chead;
        
        var title, ctitle;
        Object.defineProperty(this, 'title',
        {
            get: function() { return title; },
            set: function(value) {
                title = value;
                if (!ctitle) {
                    if (!chead)
                        return;
                    ctitle = chead.add('div');
                    ctitle.template(template);
                }
                ctitle.controls.length = 0;
                ctitle.opentag = '<title>' + value + '</title>';
                ctitle.closetag = '';
                html = this.buildHTML();
                this.raise();
            }
        });
        
        // << key elements
        
        function template() { // builder control template
            return (this.opentag || '')
                + (this.attributes.$text || '') + this.controls.map(function(control) { return control.outerHTML(); }).join('')
                + (this.closetag || '');
        };
        
        Object.defineProperty(this, 'html',
        {
            get: function() { return html; },
            set: function(value) {
                if (value !== html) {
                    html = value;
                    
                    var sections = {}, seccontrols = {};
                
                    var doc = document.implementation.createHTMLDocument('');
                    var docelement = doc.documentElement;
                    docelement.innerHTML = /<html[\s\S]*?>([\s\S]*)<\/html>/mi.exec(html)[1];

                    var chtml = controls.create('div'); // root control
                    var nodes = [], nodecontrols = [];

                    var iterator = doc.createNodeIterator(docelement, 0xFFFF, null, false),
                        node = iterator.nextNode();
                    while(node) {

                        var control = (node === docelement) ? chtml : controls.create('div');
                        control.template(template);
                        nodes.push(node);
                        nodecontrols.push(control);
                        var index = nodes.indexOf(node.parentNode);
                        if (index >= 0)
                            nodecontrols[index].add(control);

                        // parse text node
                        if (node.nodeType === 8) {
                            var text = node.nodeValue, first_char = text[0];
                            control.opentag = '<!--' + node.nodeValue + '-->';

                            if (first_char === '%') {
                                // <--%namespace.cid#params( ... )%namespace.cid-->
                                // \1 cid \2 #params \3 content
                            } else if (first_char === '!') {
                                // <!--!sectionname--> - section remover
                            } else {
                                // <--sectionname...-->
                                var namelen = text.indexOf(' '),
                                    eolpos = text.indexOf('\n'),
                                    move = text.indexOf('->');
                                if (namelen < 0 && eolpos < 0 && move < 0) {
                                    // <--sectionname--> placeholder
                                } else if (namelen < 0 && move > 0) {
                                    // <--sectionname->newname--> mover
                                } else {
                                    if (eolpos > 0 && (namelen < 0 || eolpos < namelen))
                                        namelen = eolpos;
                                    if (namelen > 0 && namelen < 128) {
                                        var secname = text.slice(0, namelen);
                                        sections[secname] = text.slice(namelen + 1);
                                        seccontrols[secname] = control;
                                    }
                                }
                            }
                        } else if (node === docelement) {
                            // incorrect parsing <html> tag
                                
                            control.opentag = '<!DOCTYPE html>\n' + /(<html[\s\S]*?>)[\s\S]*?<head/mi.exec(html)[1] + '\n';
                            control.closetag = '\n</html>';
                        } else {
                            // create template for no text node control

                            var outer = node.outerHTML, inner = node.innerHTML;
                            if (inner) {
                                var pos = outer.lastIndexOf(inner);
                                if (pos < 0)
                                    control.opentag = outer;
                                else {
                                    control.opentag = outer.slice(0,pos);
                                    control.closetag = outer.slice(pos + inner.length);
                                }
                            } else if (outer)
                                control.opentag = outer;
                            else
                                control.opentag = node.nodeValue;
                        }
                        node = iterator.nextNode();
                    }
                    
                    // >> key elements
                    
                    // head
                    var ehead = doc.getElementsByTagName('head')[0];
                    chead = ehead && nodecontrols[nodes.indexOf(ehead)];

                    
                    // title
                    var etitle = doc.getElementsByTagName('title')[0];
                    if (etitle) {
                        title = etitle.textContent;
                        ctitle = nodecontrols[nodes.indexOf(etitle)];
                    } else {
                        title = '';
                        ctitle = null;
                    }
                    
                    
                    
                    // << key elements
                    
                    this.chtml = chtml;
                    this.sections = sections;
                    this.seccontrols = seccontrols;
                    this.raise();
                }
            }
        });
        
        this.updateNamedSection = function(name, value) {
            var build_control = this.seccontrols[name];
            if (build_control) {
                this.sections[name] = value;
                build_control.opentag = '<!--' + name + '\n' + (value) + '-->\n';
                html = this.chtml.outerHTML();
            }
        };

        this.buildHTML = function() {
            return this.chtml.outerHTML();
        };
        
        
    }
    Parser.prototype = controls.create('DataObject');
    
    
    // IndexedDB adapter
    function DB(pageid, onready) {
        var db = this, modified, dbhandle;
        
        if (!window.indexedDB) {
            NoIDBError();
            return;
        }
        
        // dataobject attribute 'data' contains stored data object
        var dataobject = db.dataobject = controls.create('DataObject');
        dataobject.data = {key:pageid, sections:{}, history:[]};
        dataobject.listen(function() {
            modified = true;
        });
        setInterval(function() {
            if (modified) {
                db.write();
            }
        }, 25);
        
        
        try {
            var request = window.indexedDB.open('markdown-webdocs.editor.db', 1.0); // duplication?
        
            request.onsuccess = function(event) { 
                dbhandle = event.target.result;
                onready();
            };
            
            request.onupgradeneeded = function(event) {
                dbhandle = event.target.result;
                dbhandle.createObjectStore('drafts', {keyPath: 'key'});
                onready();
            };
            
            request.onerror = function(event) {
                errorMessage('<h4><b class="glyphicon glyphicon-warning-sign">&nbsp;</b>Editor loading error</h4>Database error');
                console.log(event);
            };
            
            request.onblocked = function(event) {
                errorMessage('<h4><b class="glyphicon glyphicon-warning-sign">&nbsp;</b>Editor loading error</h4>Database blocked');
                console.log(event);
            };
            
        } catch(e) {
            NoIDBError();
            return;
        }
        
        var restored; // dataobject is restored
        this.restore = function(callback) {
            try {
                var request = dbhandle.transaction(['drafts'], 'readonly').objectStore('drafts').get(pageid);
                request.onsuccess = function(event) {
                    var data = dataobject.data;
                    controls.extend(data, event.target.result);
                    
                    // validate restored data
                    data.key = pageid;
                    if (!Array.isArray(data.history))
                        data.history = [];
                    if (typeof data.sections !== 'object')
                        data.sections = {};
                    
                    restored = true;
                    modified = false;
                    if (callback)
                        callback();
                };
                request.onerror = function(event) {
                    console.log(event);
                };
            } catch (e) {
                // db scheme error
                // todo
            }
        };
        
        this.write = function() {
            
            if (restored)
            
            try {
                var store = dbhandle.transaction(['drafts'], 'readwrite').objectStore('drafts'),
                data = dataobject.data;
                
                if (data.delete) {
                    delete data.delete;
                    store.delete(pageid);
                }
                else
                    store.put(data);
                
                modified = false;
            } catch (e) {
                console.log(e);
                // db scheme error
                // todo
            }
        };
            
        function NoIDBError() { errorMessage('<h4><b class="glyphicon glyphicon-warning-sign">&nbsp;</b>Editor loading error</h4>Your browser does not supported and can not be used to edit documents. Please use Firefox, Chrome, Opera or Safari.'); }
    }
    
    
    // utilites panel
    function Utilities(attributes, parameters) {
        controls.controlInitialize(this, 'editor.utilites', parameters, attributes, List.template);
//        if (self === top && /(^|&)cleardb(&|$)/.test(location.search)) {
//            var request = window.indexedDB.deleteDatabase('mdwb.editor.db');
//            request.onsuccess = function(event) {
//                errorMessage('<h4>Database cleared</h4>Your browser does not supported and can not be used to edit documents. Please use Firefox, Chrome or Opera.');
//            };
//            request.onerror = function(event) {
//                errorMessage();
//            };
//            return;
//        }
    }
    
    
    function errorMessage(message) {
        // alert message
        $DOC.cbody.attachAll();
        $DOC.cbody.unshift('alert:div', {$text:message, class:'mar20 alert alert-warning col1-sm-offset-3 col-sm-6', style:'z-index:1200;'});
        $DOC.cbody.alert.createElement();
    }
    
}).call(this);