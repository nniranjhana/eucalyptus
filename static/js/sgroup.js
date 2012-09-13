/*************************************************************************
 * Copyright 2009-2012 Eucalyptus Systems, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see http://www.gnu.org/licenses/.
 *
 * Please contact Eucalyptus Systems, Inc., 6755 Hollister Ave., Goleta
 * CA 93117, USA or visit http://www.eucalyptus.com/licenses/ if you need
 * additional information or have any questions.
 ************************************************************************/

(function($, eucalyptus) {
  $.widget('eucalyptus.sgroup', $.eucalyptus.eucawidget, {
    options : { },
    baseTable : null,
    tableWrapper : null,
    delDialog : null,
    addDialog : null,
    rulesList : null,
    _init : function() {
      var thisObj = this;
      var $tmpl = $('html body').find('.templates #sgroupTblTmpl').clone();
      var $wrapper = $($tmpl.render($.extend($.i18n.map, help_sgroup)));
      var $sgroupTable = $wrapper.children().first();
      var $sgroupHelp = $wrapper.children().last();
      this.baseTable = $sgroupTable;
      this.tableWrapper = $sgroupTable.eucatable({
        id : 'sgroups', // user of this widget should customize these options,
        dt_arg : {
          "sAjaxSource": "../ec2?Action=DescribeSecurityGroups",
          "aoColumns": [
            {
              "bSortable": false,
              "fnRender": function(oObj) { return '<input type="checkbox"/>' },
              "sWidth": "20px",
            },
            { "mDataProp": "name" },
            { "mDataProp": "description" },
            {
              "bSortable": false,
              "fnRender": function(oObj) { return '<a href="#">Show rules</a>' },
              "sWidth": "200px",
              "sClass": "table_center_cell",
            }
          ],
        },
        text : {
          header_title : sgroup_h_title,
          create_resource : sgroup_create,
          resource_found : sgroup_found,
        },
        menu_actions : function(){
          return{"edit": {"name": sgroup_action_edit, callback: function(key, opt) { thisObj._editAction();}},
                 "delete" : { "name": sgroup_action_delete, callback: function(key, opt) { thisObj._deleteAction();}}};
        },
        context_menu_actions : function(state) { 
          return{"edit": {"name": sgroup_action_edit, callback: function(key, opt) { thisObj._editAction();}},
                 "delete" : { "name": sgroup_action_delete, callback: function(key, opt) { thisObj._deleteAction();}}};
        },
        menu_click_create : function (args) { thisObj.rulesList=null; $('#sgroup-rules-list').html(''); thisObj.addDialog.eucadialog('open')},
        help_click : function(evt) {
          thisObj._flipToHelp(evt, $sgroupHelp);
        },
      });
      this.tableWrapper.appendTo(this.element);
    },

    _create : function() { 
      var thisObj = this;
      $("#sgroups-selector").change( function() { thisObj.reDrawTable() } );

      var $tmpl = $('html body').find('.templates #sgroupDelDlgTmpl').clone();
      $del_dialog = $($tmpl.render($.i18n.map));

      this.delDialog = $del_dialog.eucadialog({
         id: 'sgroups-delete',
         title: sgroup_dialog_del_title,
         buttons: {
           'delete': {text: sgroup_dialog_del_btn, click: function() { thisObj._deleteSelectedSecurityGroups(); $del_dialog.eucadialog("close");}},
           'cancel': {text: dialog_cancel_btn, focus:true, click: function() { $del_dialog.eucadialog("close");}} 
         }
       });

      var createButtonId = 'sgroup-add-btn';
      var $tmpl = $('html body').find('.templates #sgroupAddDlgTmpl').clone();
      var $rendered = $($tmpl.render($.extend($.i18n.map, help_sgroup)));
      var $add_dialog = $rendered.children().first();
      var $add_help = $rendered.children().last();
      this.addDialog = $add_dialog.eucadialog({
        id: 'sgroups-add',
        title: sgroup_dialog_add_title,
        buttons: { 
        // e.g., add : { domid: sgroup-add-btn, text: "Add new group", disabled: true, focus: true, click : function() { }, keypress : function() { }, ...} 
        'create': { domid: createButtonId, text: sgroup_dialog_create_btn, disabled: true,  click: function() {
              var name = $.trim($add_dialog.find('#sgroup-name').val());
              var desc = $.trim($add_dialog.find('#sgroup-description').val());
              thisObj._storeRule();    // flush rule from form into array
              var fromPort = new Array();
              var toPort = new Array();
              var protocol = new Array();
              var cidr = new Array();
              var fromGroup = new Array();
              for (rule in thisObj.rulesList){
                  fromPort.push(thisObj.rulesList[rule].from_port);
                  toPort.push(thisObj.rulesList[rule].to_port);
                  protocol.push(thisObj.rulesList[rule].protocol);
                  cidr.push(thisObj.rulesList[rule].ipaddr);
                  fromGroup.push(thisObj.rulesList[rule].fromGroup);
              }
              var dfd = $.Deferred();
              $.ajax({
                  type:"GET",
                  url:"/ec2?Action=CreateSecurityGroup",
                  data:"_xsrf="+$.cookie('_xsrf') + "&GroupName=" + name + "&GroupDescription=" + desc,
                  dataType:"json",
                  async:"false",
                  success: function (data, textstatus, jqXHR) {
                      if (data.results && data.results.status == true) {
                          if (fromPort.length > 0) {
                              thisObj._addIngressRule(name, fromPort, toPort, protocol, cidr, fromGroup);
                          }
                          else {
                              notifySuccess(sgroup_create_success + ' ' + name);
                              thisObj._getTableWrapper().eucatable('refreshTable');
                              $add_dialog.eucadialog("close");
                          }
                      } else {
                          notifyFailure(sgroup_add_rule_error + ' ' + name);
                          $add_dialog.eucadialog("close");
                      }
                  },
                  error: function (jqXHR, textStatus, errorThrown) {
                    nofityError(null, error_creating_group_msg);
                    dfd.reject();
                    $add_dialog.eucadialog("close");
                  }
              });
            }},
        'cancel': {text: dialog_cancel_btn, focus:true, click: function() { $add_dialog.eucadialog("close");}},
        },
        help: {title: help_volume['dialog_add_title'], content: $add_help},
      });
      this.addDialog.eucadialog('onKeypress', 'sgroup-name', createButtonId, function () {
         thisObj._validateForm(createButtonId);
      });
      this.addDialog.eucadialog('onKeypress', 'sgroup-description', createButtonId, function () {
         thisObj._validateForm(createButtonId);
      });
      this.addDialog.eucadialog('onChange', 'sgroup-template', 'unused', function () {
         var thediv = $('#sgroup-morerools');
         var sel = $('#sgroup-template');
         var templ = sel.val();
         if (templ == 'none') {
            thediv.css('display','none')
            $('#sgroup-ports').val('');
         }
         else {
            thediv.css('display','block')
            if (templ.indexOf('Custom', 0) == -1) {
                var idx = templ.indexOf('port', 0);
                var part = templ.substr(idx+5);
                $('#sgroup-ports').val(parseInt(part));
            }
            else
                $('#sgroup-ports').val('');
         }
      });
      this.addDialog.find('#sgroup-ip-check').click(function () {
        $.ajax({
            type: 'GET',
            url: 'http://checkip.amazonaws.com/',
            contentType: 'text/plain; charset=utf-8',
            crossDomain: true,
            dataType: "text",
            success: function(data, textStatus, jqXHR) {
                        alert(jqXHR.responseText);
                         $('#allow-ip').val(jqXHR.responseText)
                     }
        });
      });
      this.addDialog.find('#sgroup-add-rule').click(function () {
        thisObj._storeRule();
        // now reset form
        $('#sgroup-template').val('none');
        $('#sgroup-ports').val('');
        $('#allow-ip').val('');
        $('#allow-group').val('');
        thisObj._refreshRulesList();
      });
    },

    _destroy : function() {
    },

    _validateForm : function(createButtonId) {
       name = $.trim(this.addDialog.find('#sgroup-name').val());
       desc = $.trim(this.addDialog.find('#sgroup-description').val());
       $button = this.addDialog.parent().find('#' + createButtonId);
       if ( name.length > 0 && desc.length > 0 )     
         $button.prop("disabled", false).removeClass("ui-state-disabled");
       else
         $button.prop("disabled", false).addClass("ui-state-disabled");
    },

    // this function is used to take an ingress rule from the form and move it to the rulesList
    _storeRule : function() {
        if (this.rulesList == null) {
            this.rulesList = new Array();
        }
        // if nothing selected, don't save
        if ($('#sgroup-template').val() == 'none')
            return
        var rule = new Object();
        rule.protocol = 'tcp';
        var port_range = $('#sgroup-ports').val();
        var ports = port_range.split('-');
        rule.from_port = ports[0];
        rule.to_port = ports[ports.length-1];
        if ($("input[@name='allow-group']:checked").val() == 'ip') {
            rule.ipaddr = $('#allow-ip').val();
        }
        else if ($("input[@name='allow-group']:checked").val() == 'group') {
            rule.group = $('#allow-group').val();
        }
        this.rulesList.push(rule);
    },

    // this function populates the div where rules are listed based on the rulesList
    _refreshRulesList : function() {
        if (this.rulesList != null) {
            var theDiv = $('#sgroup-rules-list')
            theDiv.html("loading...");
            var msg = "";
            var i=0
            for (rule in this.rulesList) {
                var ports = this.rulesList[rule].from_port;
                if (this.rulesList[rule].from_port != this.rulesList[rule].to_port) {
                    ports += "-"+this.rulesList[rule].to_port;
                }
                msg += "<a href='#' onclick='_deleteRule("+i+")'>Delete</a> Rule: "+this.rulesList[rule].protocol+
                            " ("+ ports+"), "+
                            this.rulesList[rule].ipaddr+"<br/>";
                i += 1;
            }
            theDiv.html(msg);
        }
    },

    // this function takes rules returned from an API call and populates the rulesList
    _fillRulesList : function(groupRecord) {
        this.rulesList = new Array();
        rules = groupRecord.rules;
        for (i=0; i<rules.length; i++) {
            var rule = new Object();
            rule.protocol = rules[i].ip_protocol;
            rule.from_port = rules[i].from_port;
            rule.to_port = rules[i].to_port;
            if (rules[i].grants[0].cidr_ip != '')
                rule.ipaddr = rules[i].grants[0].cidr_ip;
            if (rules[i].grants[0].group_id != '')
                rule.group = rules[i].grants[0].group_id;
            this.rulesList.push(rule);
        }
    },

    _deleteRule : function(index) {
        alert("deleting rule "+index);
        //TODO: need to remove rule from rulesList and/or flag for "unauthorize" call
    },

    _getGroupName : function(rowSelector) {
      return $(rowSelector).find('td:eq(1)').text();
    },

    _reDrawTable : function() {
      this.tableWrapper.eucatable('reDrawTable');
    },

    _addSecurityGroup : function(groupName, groupDesc) {
      var thisObj = this;
      return $.ajax({
        type:"GET",
        url:"/ec2?Action=CreateSecurityGroup",
        data:"_xsrf="+$.cookie('_xsrf') + "&GroupName=" + groupName + "&GroupDescription=" + groupDesc,
        dataType:"json",
        async:"true",
        success: (function(sgroupName) {
                     return function (data, textstatus, jqXHR) {
                         notifySuccess(sgroup_rule_add_success + ' ' + name);
                     }
                 }),
        error: (function(sgroupName) {
                     return function(jqXHR, textStatus, errorThrown){
                         notifyFailure(sgroup_rule_add_error + ' ' + sgroupName);
                     }
                 })
      });
    },

    _addIngressRule : function(groupName, fromPort, toPort, protocol, cidr, fromGroup) {
      var thisObj = this;
      var req_params = "&GroupName=" + groupName;
      for (i=0; i<fromPort.length; i++) {
          req_params += "&IpPermissions."+(i+1)+".IpProtocol=" + protocol[i];
          req_params += "&IpPermissions."+(i+1)+".FromPort=" + fromPort[i];
          req_params += "&IpPermissions."+(i+1)+".ToPort=" + toPort[i];
          if (cidr[i])
              req_params += "&IpPermissions."+(i+1)+".IpRanges.1.CidrIp=" + cidr[i];
          if (fromGroup[i])
              req_params += "&IpPermissions."+(i+1)+".Groups.1.Groupname=" + fromGroup[i];
      }
      $.ajax({
        type:"GET",
        url:"/ec2?Action=AuthorizeSecurityGroupIngress",
        data:"_xsrf="+$.cookie('_xsrf') + req_params,
        dataType:"json",
        async:"false",
        success: (function(sgroupName) {
            return function(data, textStatus, jqXHR){
                notifySuccess(sgroup_add_rule_success + ' ' + sgroupName);
                $add_dialog.eucadialog("close");
            }
        }),
        error: (function(sgroupName) {
            return function(jqXHR, textStatus, errorThrown){
                notifySuccess(sgroup_add_rule_error + ' ' + sgroupName);
                $add_dialog.eucadialog("close");
            }
        }),
      });
    },

    _deleteSelectedSecurityGroups : function () {
      var thisObj = this;
      var rowsToDelete = thisObj._getTableWrapper().eucatable('getSelectedRows', 1);
      for ( i = 0; i<rowsToDelete.length; i++ ) {
        var sgroupName = rowsToDelete[i];
        $.ajax({
          type:"GET",
          url:"/ec2?Action=DeleteSecurityGroup&GroupName=" + sgroupName,
          data:"_xsrf="+$.cookie('_xsrf'),
          dataType:"json",
          async:"true",
          success:
          (function(sgroupName) {
            return function(data, textStatus, jqXHR){
              if ( data.results && data.results == true ) {
                notifySuccess(sgroup_delete_success + ' ' + sgroupName);
                thisObj._getTableWrapper().eucatable('refreshTable');
              } else {
                notifyFailure(sgroup_delete_error + ' ' + sgroupName);
              }
           }
          })(sgroupName),
          error:
          (function(sgroupName) {
            return function(jqXHR, textStatus, errorThrown){
              thisObj.delDialog.eucadialog('showError', sgroup_delete_error + ' ' + sgroupName);
            }
          })(sgroupName)
        });
      }
    },

    _getTableWrapper : function() {
      return this.tableWrapper;
    },

    _deleteAction : function() {
      var thisObj = this;
      var $tableWrapper = this._getTableWrapper();
      rowsToDelete = $tableWrapper.eucatable('getSelectedRows', 1);
      var matrix = [];
      $.each(rowsToDelete,function(idx, group){
        matrix.push([group]);
      });

      if ( rowsToDelete.length > 0 ) {
        thisObj.delDialog.eucadialog('setSelectedResources', {title:[sgroup_dialog_del_resource_title], contents: matrix});
        thisObj.delDialog.dialog('open');
      }
    },

    _editAction : function() {
      //TODO: add hide menu
      var thisObj = this;
      var $tableWrapper = this._getTableWrapper();
      rowsToEdit = $tableWrapper.eucatable('getSelectedRows');
      firstRow = rowsToEdit[0];
      thisObj._fillRulesList(firstRow);
      thisObj.addDialog.dialog('option', 'title', sgroup_dialog_edit_title);
      thisObj.addDialog.dialog('open');
      thisObj.addDialog.find('#sgroup-name').val(firstRow.name);
      thisObj.addDialog.find('#sgroup-description').val(firstRow.description);
      thisObj._refreshRulesList();
    },

/**** Public Methods ****/
    close: function() {
      this._super('close');
    },

    dialogAddGroup : function() {
      var thisObj = this;
      thisObj.rulesList=null; 
      $('#sgroup-rules-list').html(''); 
      thisObj.addDialog.eucadialog('open')
    },
/**** End of Public Methods ****/
  });
})(jQuery,
   window.eucalyptus ? window.eucalyptus : window.eucalyptus = {});
