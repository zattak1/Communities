(function (window, Q, $, undefined) {

var Users = Q.Users;
var Streams = Q.Streams;
var Communities = Q.Communities;

/**
 * @module Communities
 */

/**
 * Provides an onboarding experience for new users
 * @class Communities onboarding
 * @constructor
 * @param {Object} [options] Override various options for this tool
 *  @param {String} [options.communityId] user id of the community to be onboarded into
 *  @param {String} [options.mainCommunityId] user id of the main community in the app
 *  @param {Array|string} [options.steps] names of steps to show, and in what order (the tool may skip some if the information was already filled in).
 *  They can include "name", "icon", "location", "interests".
 *  Can be string "name,icon,..."
 *  @param {Boolean} [options.speak] Whether to employ speech during the onboarding
 *  @param {Object|false} [options.usersList={}] Options to pass to the Users/list tool, or false to hide it
 *  @param {Object} [options.icon={}] Any options to pass to the icon step
 *  @param {Object} [options.icon.keepImported] If true, and some icon was imported, then skip the icon step, unless dontSkip includes it. Defaults to false.
 *  @param {Object} [options.interests={}] Any options to pass to the Streams/interests tool
 *  @param {Object} [options.interests.categories=false] Set to true to show each interest category by itself
 *  @param {Boolean} [options.profile.requireGreeting=false] Set to true to force people to enter a greeting
 *  @param {String} [options.explanation] Explanation to prepend when rendering the first step
 *  @param {Array} [options.dontSkip] names of the steps that shouldn't be skipped even if the information is already filled in
 *  @param {Array|String} [options.skip] name or names of the steps that should be skipped no matter what
 *  @param {bool} [options.dating=false] Boolean flag indicate whether show dating in profile
 *  @param {Number} [options.duration] duration in milliseconds of the transition animations
 *  @param {Boolean} [options.modifyAfterGroupPhoto] if true, open the step where user can change photo after group photo
 *  @param {Boolean} [options.locationRequired=false] If true - don't allow go forward if location not defined. If false - have button to skip this step.
 *  @param {Q.Event} [options.onStep] after the next step's handler and animation is completed
 *  @param {Q.Event} [options.onComplete] after all the steps have been completed. First parameter is true if onboarding was taking place in a dialog.
 */

Q.Tool.define("Communities/onboarding", function Communities_onboarding_tool() {
        var tool = this;
        var state = tool.state;
        if (!Users.loggedInUser) {
            throw new Q.Error("Communities/onboarding: user is not logged in");
        }

        // Fall back to server config if options were not applied yet
        // (e.g. tool activated before Q.onInit define.options ran).
        if (Q.isEmpty(state.steps)) {
            var serverOptions = Q.getObject(['onboarding', 'serverOptions'], Communities);
            if (serverOptions) {
                Q.extend(state, Q.Tool.options.levels, serverOptions);
            }
        }

        if (Q.typeOf(state.steps) === 'string') {
            state.steps = state.steps.split(',');
        }

        if (Q.isEmpty(state.steps)) {
            throw new Q.Error("Communities/onboarding: steps needs to have at least one element");
        }
        state.interests = Q.extend({}, Communities.interests, state.interests);
        state.showed = [];
        tool.$current = $('<div class="Communities_onboarding_step" />')
            .appendTo(tool.element)
            .addClass('Communities_onboarding_' + state.steps[0]);

        state.html = Q.extend({}, 10, tool.text.onboarding, 10, state.html);
        tool.forEachChild('Users/pile', function () {
            var pile = this;
            $(tool.element).on(Q.Pointer.fastclick, '.Users_pile_tool', function () {
                if (Q.isEmpty(pile.state.allUserIds)) {
                    return;
                }
                var $content = $('<div />').tool("Users/list", {
                    userIds: pile.state.allUserIds.slice(0, 20),
                    clickable: true
                });
                Q.Dialogs.push({
                    className: 'Communities_pile_dialog',
                    title: state.html.pile.DialogTitle,
                    content: $content
                });
            });
        });

        tool.refresh();

    },
    {
        communityId: Users.currentCommunityId,
        mainCommunityId: Users.communityId,
        steps: [],
        skip: [],
        dontSkip: ["name"],
        current: 0,
        $current: 0,
        duration: 300,
        html: {},
        speak: true,
        explanation: null,
        locationRequired: false,
        modifyAfterGroupPhoto: false,
        usersList: {
            userIds: null
        },
        name: {
            defaultIconSize: 200
        },
        icon: {
            keepImported: false
        },
        interests: {
            categories: true,
            pileMax: 10
        },
        profile: {
            dating: false,
            height: true,
            birthday: true,
            gender: true,
            requireGreeting: true
        },
        onStep: new Q.Event(function () {
            var scrollingParent = this.element.scrollingParent(false, "vertical", true);
            scrollingParent && scrollingParent.scrollTo(0,0);
            Q.Visual.stopHints();
        }),
        onComplete: new Q.Event(function (inDialog) {
            if (inDialog) {
                Q.Dialogs.close(inDialog);
            } else if (Q.info.uri.module === 'Communities' && Q.info.uri.action === 'onboarding') {
                if (!Q.isEmpty(Q.Users.onComplete.handlers)) {
                    Q.handle(Q.Users.onComplete);
                } else {
                    Q.handle(Q.Users.urls.onComplete);
                }
            }
        }, 'Communities'),
        transition: function ($from, $to, duration, callback) {
            var tool = this;
            $from.stop().slideUp(duration);
            $to.stop().slideDown(duration, function () {
                Q.handle(callback, tool);
            });
        },
        handlers: {
            name: function ($element) {
                var tool = this;
                var state = tool.state;
                var step = state.steps[state.current];
                var userId = Users.loggedInUser.id;
                var pipe = new Q.Pipe(['community', 'user'], function (params, subjects) {
                    var hasName = subjects.user.firstName || subjects.user.lastName;
                    var dontSkip = state.dontSkip && state.dontSkip.indexOf(step) >= 0;
                    if (!dontSkip && hasName
                        || state.skip === step
                        || (state.skip && state.skip.indexOf(step) >= 0)) {
                        return tool.next(0);
                    }
                    var p = Q.pipe(['activated', 'inited'], 1, function () {
                        var $input = $element.find('.Communities_onboarding_name_fullname');
                        $input.plugin('Q/placeholders');
                        if (Q.info.isTouchscreen) {
                            Q.Pointer.hint($input[0], {
                                dontStopBeforeShown: true,
                                show: { delay: 1000 }
                            });
                        } else {
                            $input.plugin('Q/clickfocus');
                        }
                        _handleUserList(tool, $element);
                        var _submitted = false;
                        setTimeout(function _setBlurHandler() {
                            $input.on('blur.Communities_onboarding', function (e) {
                                if (_submitted || !$input.val()) {
                                    return false;
                                }
                                if ($input.val().length <= 4) {
                                    Q.alert(Q.getObject("html.name.TooShort", state), {
                                        onClose: function () {
                                            $input.plugin('Q/clickfocus');
                                        }
                                    });
                                    return false;
                                }
                                var confirmText = Q.getObject("html.name.SetAsYourFullName", state);
                                confirmText = typeof confirmText === 'string' && confirmText.interpolate([$input.val()]);
                                Q.confirm(confirmText,
                                    function (proceed) {
                                        if (proceed) {
                                            _submit();
                                        } else {
                                            $input.off('blur.Communities_onboarding');
                                            setTimeout(_setBlurHandler, 500);
                                            $input.plugin('Q/clickfocus');
                                        }
                                    }, {
                                        ok: Q.getObject("html.Yes", state),
                                        cancel: Q.getObject("html.No", state)
                                    });
                            });
                        }, 500);
                        var $form = $element.find('.Communities_onboarding_name_form');
                        $form.submit(_submit);
                        function _submit() {
                            _submitted = true;
                            document.activeElement.blur();
                            Q.req('Streams/basic', function (err, response) {
                                var msg = Q.firstErrorMessage(err, response && response.errors)
                                if (msg) {
                                    return alert(msg);
                                }
                                Streams.Stream.refresh(userId, "Streams/user/firstName", null, {
                                    evenIfNotRetained: true
                                });
                                Streams.Stream.refresh(userId, "Streams/user/lastName", null, {
                                    evenIfNotRetained: true
                                });
                                tool.next();
                            }, {
                                fields: {fullName: $input.val()},
                                method: 'post'
                            });
                            return false;
                        }
                    });

                    var iconSize = state.name.defaultIconSize;
                    Q.Streams.get(state.communityId, 'Streams/user/icon', function (err) {
                        if (!err) {
                            iconSize = Q.largestSize(this.getAttribute('sizes'), false, {
                                minimumDimensions: '400x400'
                            });
                        }
                        Q.Template.render('Communities/onboarding/name', {
                            existingName: hasName,
                            usersList: state.usersList,
                            owner: Q.getObject(["roles", 'Users/owners'], Users),
                            admin: Q.getObject(["roles", 'Users/admins'], Users),
                            member: Q.getObject(["roles", 'Users/members'], Users),
                            guest: Q.getObject(["roles", 'Users/guests'], Users),
                            communityId: state.communityId,
                            communityName: subjects.community.username,
                            publisherId: userId,
                            iconUrl: subjects.community.iconUrl(iconSize),
                            Placeholder: state.html.name.Placeholder,
                            GetStarted: state.html.name.GetStarted,
                            Preface: Users.communityName.length > 10 ? '' : state.html.name.Preface
                        }, function (err, html) {
                            $element.html(html).activate({
                                ".Users_list_tool": {
                                    userIds: state.usersList.userIds
                                }
                            }, p.fill('activated'));
                            $element.find('.Communities_continue_button').plugin('Q/clickable')
                            .on(Q.Pointer.fastclick, function () {
                                tool.next();
                                return false;
                            });
                            if (state.speak) {
                                Q.Audio.speak(tool.text.speak.onboarding.name.Welcome.interpolate({
                                    CommunityName: Q.Users.communityName
                                }), {
                                    onSpeak: function () {
                                        var step = state.steps[state.current];
                                        if (step !== 'name') {
                                            return;
                                        }
                                        Q.Pointer.hint(tool.$('.Communities_continue_button'), {
                                            show: { delay: 2000 }
                                        });
                                    }
                                });
                            } else {
                                Q.Pointer.hint(tool.$('.Communities_continue_button'));
                            }        
                        }, {tool: tool});
    
                        tool.Q.onInit.add(p.fill('inited'), tool); // after children were inited
                    });
                });
                Q.Streams.Avatar.get(state.communityId || Q.Users.communityId, pipe.fill('community'));
                Q.Streams.Avatar.get(userId, pipe.fill('user'));
            },
            icon: function ($element) {
                var tool = this;
                var state = tool.state;
                var step = state.steps[state.current];
                var dontSkip = state.dontSkip && state.dontSkip.indexOf(step) >= 0;
                if (!dontSkip && Q.Users.isCustomIcon(Users.loggedInUser.icon, !state.icon.keepImported)) {
                    return tool.next(0);
                }
                var userId = Users.loggedInUser.id;
                var streamName = 'Streams/user/icon';

                Q.Streams.get.force(userId, streamName, function (err) {
                    if (err) {
                        return;
                    }

                    // // if icon already customized just show it
                    // if (Q.Users.isCustomIcon(this.fields.icon, true)) {
                    //     return _renderTemplate();
                    // }

                    // check if group photo exists
                    var url = new URL(location.href);
                    var data = Q.getObject('Q.plugins.Streams.invited.dialog');
                    var inviteToken = Q.getObject('token', data) || url.searchParams.get("Q.Streams.token");
                    var invitingUserId = Q.getObject("invitingUser.id", data) || url.searchParams.get("invitingUserId");
                    if (!inviteToken || !invitingUserId) {
                        return _renderTemplate();
                    }

                    Streams.get(invitingUserId, "Streams/image/invite/" + inviteToken, function (err) {
                        if (err) {
                            // invite is missing, so no group photo
                            return _renderTemplate();
                        }

                        var stream = this;
                        $element.tool("Streams/groupPhoto", {
                            photoUrl: stream.iconUrl(Q.image.defaultSize['Streams/invite/groupPhoto']),
                            publisherId: stream.fields.publisherId,
                            streamName: stream.fields.name
                        }).activate(function () {
                            var groupPhotoTool = this;
                            groupPhotoTool.state.onSkip.set(function () {
                                _renderTemplate();
                            }, groupPhotoTool);
                            groupPhotoTool.state.onChoose.set(function (imgBase64EncodedDate, box) {
                                groupPhotoTool.showLoader();
                                Q.req("Q/image", function () {
                                    Q.Tool.remove($element[0], true, false, "Streams/groupPhoto");
                                    $element.removeClass("Streams_groupPhoto_tool").removeClass("Q_tool");
                                    $element.empty();
                                    Q.Streams.get.force(userId, streamName, state.modifyAfterGroupPhoto ? _renderTemplate : tool.next.bind(tool));
                                }, {
                                    method: "post",
                                    fields: {
                                        data: imgBase64EncodedDate,
                                        path: 'Q/uploads/Users',
                                        subpath: userId.splitId() + '/icon/' + Math.floor(Date.now()/1000),
                                        save: "Users/icon"
                                    }
                                });
                            }, groupPhotoTool);
                        });
                    });
                });

                var _renderTemplate = function () {
                    Q.Template.render('Communities/onboarding/icon', {
                        displayName: Users.loggedInUser.displayName,
                        KeepDefault: state.html.icon.KeepDefault,
                        SetYourPhoto: Q.getObject("html.icon.SetYourPhoto", state)
                            .interpolate(Q.text.Q.words),
                        usersList: state.usersList,
                    }, function (err, html) {
                        $element.html(html).activate({
                            '.Streams_preview_tool': {
                                publisherId: userId,
                                streamName: streamName,
                                closeable: false,
                                imagepicker: {
                                    showSize: Q.largestSize(Q.image.sizes['Users/icon'], false, {
                                        minimumDimensions: '400x400'
                                    }) || '1000',
                                    saveSizeName: 'Users/icon',
                                    save: 'Users/icon',
                                    onSuccess: {"Communities/onboarding": function () {
                                        tool.next();
                                    }},
                                    onCropping: {"Communities/onboarding": function (dialog) {
                                            Q.Pointer.hint($('.Q_close', dialog)[0], {
                                                show: { delay: 5000 },
                                                dontStopBeforeShown: true
                                            });
                                        }}
                                }
                            },
                            '.Streams_image_preview_tool': {
                                showTitle: false,
                                updateTitle: false
                            },
                            '.Users_list_tool': {
                                userIds: state.usersList.userIds
                            }
                        }, function () {
                            Q.Streams.get(userId, streamName, function (err) {
                                if (err) {
                                    return;
                                }

                                $element.attr('data-custom-icon', Q.Users.isCustomIcon(this.fields.icon));
                            });

                            var $preview = $element.find('.Streams_image_preview_tool');
                            var o = {
                                dontStopBeforeShown: true,
                                show: { delay: 2000 }
                            };
                            if (state.speak) {
                                o.speak = {
                                    text: tool.text.speak.onboarding.icon.Commentary
                                }
                            }
                            Q.Pointer.hint($preview[0], o);
                            tool.forEachChild('Streams/image/preview', function () {
                                setTimeout(function () {
                                    this.$('.Streams_image_preview_icon').css(
                                        'animation', 'Q_pulsate 5s ease-in-out infinite;'
                                    );
                                }, 300);
                            });
                            $element.find('.Communities_onboarding_icon_skip').plugin('Q/clickable').click(function () {
                                tool.next();
                            });
                            Streams.Stream.onFieldChanged(userId, streamName, 'icon').set(function (fields) {
                                $element.attr('data-custom-icon', Q.Users.isCustomIcon(fields.icon));
                            }, tool);
                        });
                    }, {tool: tool});
                };
            },
            location: function ($element) {
                var tool = this;
                var state = tool.state;
                var userId = Users.loggedInUser.id;
                Streams.get(userId, 'Places/user/location', function (err, stream) {
                    if (!err) {
                        var meters = this.getAttribute('meters');
                        var latitude = this.getAttribute('latitude');
                        var longitude = this.getAttribute('longitude');
                        var step = state.steps[state.current];
                        var dontSkip = state.dontSkip && state.dontSkip.indexOf(step) >= 0;
                        if (!dontSkip && latitude && longitude && meters) {
                            return tool.next(0);
                        }
                    }
                    Q.Template.render('Communities/onboarding/location', {
                        'NoOneElse': state.html.location.NoOneElse
                    }, function (err, html) {
                        $element.html(html).activate({
                            '.Places_user_location_tool': {
                                updateButton: Q.getObject("html.location.SetMyLocation", state)
                            }
                        }, function () {
                            var locationTool = tool.child('Places_user_location');
                            locationTool.state.onReady.add(function () {
                                var $locationSet;
                                if (tool.state.setMapButton) {
                                    $locationSet = tool.$('.Places_user_location_button');
                                } else if (tool.state.globe) {
                                    $locationSet = tool.$('.Places_globe_tool');
                                } else {
                                    $locationSet = tool.$('.Places_user_location_set');
                                }
                                if (!$locationSet.is(':visible')) {
                                    $locationSet = tool.$('.Places_user_location_update');
                                }
                                Q.Pointer.hint($locationSet, {
                                    dontStopBeforeShown: true,
                                    show: { delay: 500 }
                                });
                            }, 'Communities/onboarding');
                            locationTool.state.onUpdate.set(function () {
                                tool.next();
                            }, 'Communities/onboarding');

                            if (!state.locationRequired) {
                                $("<a href='skip' />")
                                    .text(tool.text.onboarding.Skip)
                                    .on(Q.Pointer.click, function () {
                                        tool.next();
                                        return false;
                                    }).appendTo(
                                    $('<div />').appendTo(
                                        $(".Communities_location_reassure", tool.element)
                                    )
                                )
                                    .plugin("Q/clickable");
                            }
                        });
                    }, {tool: tool});
                });
            },
            interests: function ($element) {
                var tool = this;
                var state = tool.state;
                var $te = $(tool.element);
                var p = new Q.Pipe(['all', 'my'], function (params, subject) {
                    var interestsTool, pileTool, pagingTool, style, $fade, $next;
                    var sh = state.html;
                    var shi = sh.interests;
                    var all = Q.Streams.Interests.all[state.mainCommunityId];
                    var si = state.interests = state.interests || {};
                    var ordering = si.ordering = si.ordering || Q.getObject(["ordering", state.mainCommunityId], Q.Streams.Interests);
                    var spoke = {};
                    if (!Q.isEmpty(params.my)) {
                        var step = state.steps[state.current];
                        var dontSkip = state.dontSkip && state.dontSkip.indexOf(step) >= 0;
                        if (!dontSkip && !Q.isEmpty(params.my[1])) {
                            return tool.next(0);
                        }
                    }
                    if (!ordering.length) {
                        tool.next(0);
                    }
                    var o = Q.extend({}, shi, {
                        'Q/paging': {
                            index: -1,
                            total: ordering.length
                        },
                        instructions: shi.Instructions.interpolate([
                            ordering.length,
                            Q.info.isTouchscreen ? sh.Tap : sh.Click
                        ]),
                        next: si.categories ? shi.GetStarted : shi.Continue,
                        secondClass: si.categories
                            ? 'Communities_onboarding_interests_categories'
                            : ''
                    });
                    Q.Template.render('Communities/onboarding/interests', o,
                        function (err, html) {
                            $element.html(html).activate({
                                '.Streams_interests_tool': Q.extend({
                                    updateButton: Q.getObject("html.location.SetMyLocation", state)
                                }, si)
                            }, function () {
                                style = $('<style type="text/css" />').prependTo(tool.element)[0];
                                pagingTool = tool.child('Q_paging');
                                interestsTool = tool.child('Streams_interests');
                                pileTool = tool.child('Users_pile');
                                $fade = $(interestsTool.element)
                                    .nextAll('.Communities_fade_bottom').eq(0)
                                    .hide();
                                interestsTool.state.onReady.add(function () {
                                    $next = tool.$('.Communities_onboarding_next').eq(0);
                                    $next.plugin('Q/clickable')
                                        .on(Q.Pointer.fastclick, _nextCategory);
                                    if (si.categories) {
                                        _handleFading();
                                        Q.Pointer.hint($next, {
                                            dontStopBeforeShown: false,
                                            show: { delay: 3000 }
                                        });
                                    }
                                    if (si.skipInstructions && pagingTool.state.index < 0) {
                                        _nextCategory();
                                    }
                                    pagingTool.state.total = this.$('.Q_expandable_tool')
                                        .not('.Streams_interests_drilldown').length;
                                    pagingTool.refresh();
                                }, tool);
                                var _interestUserIds = {};
                                interestsTool.state.onClick.set(
                                    function (element, normalizedTitle, category, interest, wasSelected) {
                                        _updateCategories(normalizedTitle, state.mainCommunityId, wasSelected);
                                        if (wasSelected) {
                                            _interestUserIds[normalizedTitle] = null;
                                            return _updatePile(true);
                                        }
                                        var streamName = "Streams/interest/"+normalizedTitle;
                                        Q.Streams.get(state.mainCommunityId, streamName,
                                            function (err, stream, extra) {
                                                _interestUserIds[normalizedTitle] = extra && extra.participants;
                                                _updatePile();
                                            }, { participants: 100 });
                                    }, tool);
                                function _updateCategories(normalizedTitle, communityId, wasSelected) {
                                    var category = Streams.Interests.drilldownCategory(
                                        state.mainCommunityId, normalizedTitle
                                    );
                                    if (!category) {
                                        return;
                                    }
                                    var nc = Q.normalize(category);
                                    var $jq = $('.Q_expandable_'+nc+'.Streams_interests_drilldown');
                                    var i = state.interests.ordering.indexOf(category);
                                    if (!wasSelected && $jq.length) {
                                        tool.$('.Q_expandable_'+nc)
                                            .removeClass('Streams_interests_drilldown');
                                        ++pagingTool.state.total;
                                    } else if (wasSelected && !$jq.length) {
                                        tool.$('.Q_expandable_'+nc)
                                            .addClass('Streams_interests_drilldown');
                                        --pagingTool.state.total;
                                    }
                                    pagingTool.refresh();
                                }
                                function _updatePile(wasSelected) {
                                    var a = {};
                                    for (var normalizedTitle in _interestUserIds) {
                                        for (var userId in _interestUserIds[normalizedTitle]) {
                                            a[userId] = true;
                                        }
                                    }
                                    var userIds = Object.keys(a);
                                    Q.shuffle(userIds);
                                    pileTool.state.allUserIds = userIds;
                                    pileTool.state.userIds = userIds.slice(0, state.interests.pileMax || 10);
                                    pileTool.state.caption = userIds.length <= 999
                                        ? userIds.length
                                        : '999+';
                                    pileTool.stateChanged(['userIds', 'caption']);
                                    var $pe = $(pileTool.element);
                                    if (pileTool.state.caption) {
                                        $pe.show();
                                    } else {
                                        $pe.hide();
                                    }
                                    if (!wasSelected) {
                                        pileTool.caption.removeClass('Q_pop').addClass('Q_pop');
                                    }
                                    setTimeout(function () {
                                        pileTool.caption.removeClass('Q_pop');
                                    }, 1000);
                                }
                            }).find('.Q_paging_tool').hide();
                        }, {tool: tool});
                    var categoryIndex = 0;
                    function _nextCategory () {
                        if (!si.categories) {
                            tool.next();
                            return;
                        }
                        ++categoryIndex;
                        var $p1, $p2, $p3;
                        $p1 = $te.find('.Q_expandable_tool:visible').eq(0);
                        if ($p1.length) {
                            $p2 = $p1.nextAll('.Q_expandable_tool')
                                .not('.Streams_interests_drilldown').eq(0);
                        } else {
                            $p1 = $te.find('.Communities_onboarding_instructions');
                            $p2 = $(tool.element).find('.Q_expandable_tool').eq(0);
                        }
                        var $container = $te.find('.Communities_onboarding_interests');
                        $p1.slideUp(300);
                        if ($p2.length) {
                            var expandable = $p2[0].Q('Q/expandable');
                            expandable.expand();
                            var scrollingParent = $p2[0].scrollingParent();
                            $(scrollingParent).scrollTop(0);
							var css = {
								background: Q.getObject([state.mainCommunityId, expandable.state.category, "background"], Streams.Interests.info),
								color: Q.getObject([state.mainCommunityId, expandable.state.category, "color"], Streams.Interests.info)
							};
							Object.keys(css).forEach((k) => Q.isEmpty(css[k]) && delete css[k]);
                            if (!Q.isEmpty(css)) {
                                $container.css(css);
                            }
                            $p3 = $p2.next('.Q_expandable_tool');
                            pileTool.state.userIds = [];
                            pileTool.state.caption = null;
                            pileTool.stateChanged(['userIds', 'caption']);
                            _interestUserIds = {};
                            $fade.hide();
                            $p2.slideDown(400, function () {
                                _handleFading();
                                ++pagingTool.state.index;
                                $element.find('.Q_paging_tool').show();
                                pagingTool.stateChanged('index');
                                $next.html($p3.length
                                    ? shi.NextCategory
                                    : shi.Continue
                                );
                                var category = expandable.state.category
                                var prompt = Q.getObject(
                                    [state.mainCommunityId, category, 'prompt'],
                                    Streams.Interests.info
                                );
                                if (prompt) {
                                    var $title = $p2.find('.Streams_interests_category_title');
                                    var $prompt = $title.next('.Streams_interests_category_prompt');
                                    if (!$prompt.length) {
                                        $prompt = $("<div class='Streams_interests_category_prompt' />")
                                            .html(prompt)
                                            .insertAfter($title);
                                    }
                                }
                                var my = params.my[1];
                                for (var normalized in my) {
                                    var title = my[normalized];
                                    var $jq = tool.$('#Streams_interest_title_' + normalized).addClass('Streams_interests_anotherUser');
                                    if ($jq.length) {
                                        var category = Streams.Interests.drilldownCategory(
                                            state.mainCommunityId, normalized
                                        );
                                        if (category) {
                                            var nc = Q.normalize(category);
                                            var cssClass = '.Q_expandable_'
                                                +nc+'.Streams_interests_drilldown';
                                            if (tool.$(cssClass).length) {
                                                tool.$('.Q_expandable_'+nc)
                                                    .removeClass('Streams_interests_drilldown');
                                                ++pagingTool.state.total;
                                            }
                                            pagingTool.refresh();
                                        }
                                    }
                                }
                                var $it = $p2.closest('.Streams_interests_tool');
                                if ($p2.outerHeight() > $it.height() && Q.info.isTouchscreen) {
                                    Q.Pointer.hint($p2, {
                                        src: '{{Q}}/img/hints/swipe-up.gif'
                                    });
                                } else {
                                    var delay = categoryIndex * 1000;
                                    var i = 0;
                                    $jq = $p2.find('.Streams_interest_title');
                                    var len = $jq.length;
                                    if (state.speak && !spoke.interestsCommentary) {
                                        spoke.interestsCommentary = true;
                                        Q.Audio.speak(tool.text.speak.onboarding.interests.Commentary);
                                    }
                                    $jq.each(function () {
                                        Q.Pointer.hint(this, {
                                            dontRemove: true,
                                            show: { delay: delay },
                                            hide: { after: 1000 },
                                            classes: "Communities_onboarding_interests",
                                            styles: {
                                                opacity: 1 - (i / len / 2)
                                            }
                                        });
                                        delay += 100 * Math.pow(0.9, i);
                                        ++i;
                                    });
                                }
                                $(scrollingParent).scrollTop(0);
                            });
                        } else {
                            tool.next();
                        }
                    }
                    function _handleFading() {
                        $fade.hide();
                        var e = interestsTool.element;
                        if (e.scrollHeight <= e.clientHeight) {
                            $fade.hide();
                            return;
                        }
                        Q.addScript('{{Q}}/js/Color.js', function () {
                            var color = new Q.Color(
                                tool.$('.Communities_onboarding_interests')
                                    .css('background-color')
                            );
                            var rgb = [color.r, color.g, color.b].join(',');
                            var css = ".Communities_onboarding_interests"
                                + " .Communities_fade_bottom {"
                                + "background: -moz-linear-gradient(top, rgba("+rgb+",0) 0%, rgba("+rgb+",1) 100%);"
                                + "background: -webkit-linear-gradient(top, rgba("+rgb+",0) 0%,rgba("+rgb+",1) 100%);"
                                + "background: linear-gradient(to bottom, rgba("+rgb+",0) 0%,rgba("+rgb+",1) 100%);"
                                + "}";
                            if (Q.info.isIE(0, 8)) {
                                style.styleSheet.cssText = css;
                            } else {
                                if (style.firstChild) {
                                    style.removeChild(style.firstChild);
                                }
                                style.appendChild(document.createTextNode(css))
                            }
                            $fade.show();
                        });
                    }
                });
                Streams.Interests.load(state.mainCommunityId, true, p.fill('all'));
                Streams.Interests.forMe(state.mainCommunityId, p.fill('my'));
            },
            profile: function ($element) {
                var tool = this;
                var state = tool.state;
                var $te = $(tool.element);
                var $month = $('<select name="input_birthday_month" />').append(
                    $('<option disabled="disabled" selected="selected">' + Q.getObject("html.profile.Month", state) + '</option>')
                );
                var $day = $('<select name="input_birthday_day" />').append(
                    $('<option disabled="disabled" selected="selected">' + Q.getObject("html.profile.Day", state) + '</option>')
                );
                var $year = $('<select name="input_birthday_year" />').append(
                    $('<option disabled="disabled" selected="selected">' + Q.getObject("html.profile.Year", state) + '</option>')
                );
                var thisYear = (new Date()).getFullYear();
                for (var year = thisYear - 12; year >= thisYear - 120; --year) {
                    $year.append($('<option />', { value: year }).text(year));
                }
                var months = Q.text.Q.months;
                var i;
                Q.each(months, function (k, month) {
                    var i = parseInt(k);
                    $month.append($('<option />', {
                        value: i < 10 ? '0'+i : i
                    }).text(month));
                });
                for (i=1; i<=31; ++i) {
                    $day.append($('<option />', {
                        value: i < 10 ? '0'+i : i
                    }).text(i));
                }
                var $gender = $('<select name="input_gender" />').append(
                    $('<option disabled="disabled" selected="selected">' + Q.getObject("html.profile.Gender", state) + '</option>')
                );
                $gender.append(
                    $('<option />', { value: 'male' }).text(Q.getObject("html.profile.Male", state)),
                    $('<option />', { value: 'female' }).text(Q.getObject("html.profile.Female", state)),
                    $('<option />', { value: 'other' }).text(Q.getObject("html.profile.Other", state))
                );
                var $height = $('<select name="input_height" />').append(
                    $('<option disabled="disabled" selected="selected">' + Q.getObject("html.profile.Height", state) + '</option>')
                );
                for (i=12*3+6; i<=12*8; ++i) {
                    var cm = Math.floor(i * 2.54);
                    var feet = Math.floor(i / 12);
                    var inches = i % 12;
                    $height.append(
                        $('<option />', { value: cm }).text(feet + "'" + inches + '"')
                    );
                }
                var affiliations = Communities.affiliations;
                if (affiliations) {
                    var $affiliation = $('<select name="input_affiliation" />').append(
                        $('<option disabled="disabled" selected="selected">' + Q.getObject("html.profile.Affiliation", state) + '</option>')
                    );
                    for (var affiliation in affiliations) {
                        $affiliation.append(
                            $('<option />', { value: affiliation }).text(affiliations[affiliation])
                        );
                    }
                }
                var $dating = $('<select name="input_dating" />').append(
                    $('<option disabled="disabled" selected="selected">' + Q.getObject("html.profile.Dating", state) + '</option>')
                );
                $dating.append(
                    $('<option />', { value: 'yes' }).text(Q.getObject("html.profile.Interested", state)),
                    $('<option />', { value: 'no' }).text(Q.getObject("html.profile.NotInterested", state)),
                    $('<option />', { value: 'matchmaker' }).text(Q.getObject("html.profile.MatchmakerOnly", state))
                );
                var publisherId = Users.loggedInUser.id;
                var greetingStreamName = 'Streams/greeting/' + state.mainCommunityId;
                Q.Streams.retainWith(tool)
                    .get(publisherId, greetingStreamName, function (err, stream) {
                        Q.Template.render('Communities/onboarding/profile', {
                            requiredClass: state.profile.requireGreeting ? 'Communities_onboarding_profile_greetingIsRequired' : '',
                            personal: Communities.profile.personal,
                            birthday: state.profile.birthday ? $month[0].outerHTML + $day[0].outerHTML + $year[0].outerHTML : '',
                            gender: state.profile.gender ? $gender[0].outerHTML : '',
                            height: state.profile.height ? $height[0].outerHTML : '',
                            affiliation: !Q.isEmpty(affiliations) ? $affiliation[0].outerHTML : '',
                            dating: state.profile.dating ? $dating[0].outerHTML : '',
                            action: Q.url('{{Streams}}/form'),
                            value: JSON.stringify({
                                birthday: [true, publisherId, "Streams/user/birthday", "content"],
                                gender: [true, publisherId, "Streams/user/gender", "content"],
                                height: [true, publisherId, "Streams/user/height", "content"],
                                affiliation: [true, publisherId, "Streams/user/affiliation", "content"],
                                dating: [true, publisherId, "Streams/user/dating", "content"]
                            }),
                            Profile: state.html.profile.Profile,
                            Birthday: state.html.profile.Birthday,
                            Placeholder: state.html.profile.Placeholder,
                            Required: state.html.profile.Required,
                            Done: state.html.Done
                        }, function (err, html) {
                            var greeting;
                            $element.html(html).activate();
                            var $greeting = $('.Communities_onboarding_greeting', $element);
                            $greeting.val(stream.fields.content);
                            $greeting.plugin('Q/autogrow').plugin('Q/placeholders').plugin('Q/clickfocus');
                            var $continue = $('.Communities_continue_button', $element);
                            if (state.profile.requireGreeting) {
                                if (!stream.fields.content) {
                                    $continue.addClass('Q_disabled');
                                }
                                $greeting.on('change input', function () {
                                    var val = $greeting.val();
                                    if (val && val.length > 10) {
                                        $('.Communities_onboarding_profile')
                                            .removeClass('Communities_onboarding_profile_greetingIsRequired');
                                        $continue.removeClass('Q_disabled');
                                    } else {
                                        $('.Communities_onboarding_profile')
                                            .addClass('Communities_onboarding_profile_greetingIsRequired');
                                        $continue.addClass('Q_disabled');
                                    }
                                });
                            }
                            $continue.plugin('Q/clickable')
                                .on(Q.Pointer.fastclick, function () {
                                    greeting = stream;
                                    greeting.set('content', $greeting.val());
                                    greeting.save({
                                        onSave: function (err) {
                                            if (err) {
                                                Q.alert(err);
                                            } else {
                                                tool.next();
                                            }
                                        }
                                    });
                                });
                            tool.$('.Communities_onboarding_explanation').plugin('Q/textfill');
                            var parts = ['greeting'];
                            if (state.profile.birthday) { parts.push('birthday'); }
                            if (state.profile.gender) { parts.push('gender'); }
                            if (state.profile.height) { parts.push('height'); }
                            var p = Q.pipe(parts,
                                function (params) {
                                    var complete = true;
                                    for (var k in params) {
                                        if (!params[k][0]) {
                                            complete = false;
                                        }
                                    }
                                    if (complete) {
                                        tool.next();
                                    }
                                });
                            Q.Streams.retainWith(tool)
                                .get(publisherId, "Streams/user/birthday", function (err, stream) {
                                    if (err) {
                                        return p.fill('birthday')(false);
                                    }
                                    var parts = stream.fields.content.split('-');
                                    parts[0] && tool.$('select[name=input_birthday_year]').val(parts[0]);
                                    parts[1] && tool.$('select[name=input_birthday_month]').val(parts[1]);
                                    parts[2] && tool.$('select[name=input_birthday_day]').val(parts[2]);
                                    p.fill('birthday')(!!stream.fields.content);
                                });
                            Q.Streams.retainWith(tool)
                                .get(publisherId, "Streams/user/gender", function (err, stream) {
                                    if (err) {
                                        return p.fill('gender')(false);
                                    }
                                    stream.fields.content && tool.$('select[name=input_gender]').val(stream.fields.content);
                                    p.fill('gender')(!!stream.fields.content);
                                });
                            Q.Streams.retainWith(tool)
                                .get(publisherId, "Streams/user/height", function (err, stream) {
                                    if (err) {
                                        return p.fill('height')(false);
                                    }
                                    stream.fields.content && tool.$('select[name=input_height]').val(stream.fields.content);
                                    p.fill('height')(!!stream.fields.content);
                                });
                            Q.Streams.retainWith(tool)
                                .get(publisherId, greetingStreamName, function (err, stream) {
                                    greeting = stream;
                                    p.fill('greeting')(!err && stream.fields.content);
                                });
                        }, {tool: tool});
                    }
                );
            },
            relationships: function ($element) {
                var tool = this;
                var state = tool.state;
                var url = new URL(location.href);
                var inviteToken = url.searchParams.get("Q.Streams.token");
                var invitingUserId = url.searchParams.get("invitingUserId");
                if (!inviteToken) {
                    return tool.next();
                }
                var lskey = 'Q.Communities.onboarding.relationships';
                var shown = localStorage.getItem(lskey);
                var step = state.steps[state.current];
                var dontSkip = state.dontSkip && state.dontSkip.indexOf(step) >= 0;
                if (!dontSkip && shown) {
                    return tool.next();
                }
                var instructions = false;
                if (Q.info.isMobile) {
                    if (Q.info.isAndroid()) {
                        instructions = Q.getObject("onboarding.relationships.androidInstructions", tool.text) || 'You should open this vCard file after it will be downloaded.';
                    } else {
                        instructions = Q.getObject("onboarding.relationships.iosInstructions", tool.text) || 'Scroll down to create new contact';
                    }
                }
                var explanation = Q.getObject("onboarding.relationships.explanation", tool.text) || 'What is your relationship?';
                Q.Streams.Avatar.get(invitingUserId, function (err, avatar) {
                    if (err) {
                        return;
                    }

                    Q.Template.render('Communities/onboarding/relationships', {
                        invitedByUser: Q.getObject("onboarding.relationships.invitedByUser", tool.text) || 'invited you',
                        instructions: instructions,
                        explanation: explanation,
                        Done: state.html.Done,
                        invitingUserId: invitingUserId
                    }, function (err, html) {
                        if (err) {
                            console.warn('Error while rendering template')
                            return tool.next();
                        }

                        $element.html(html).activate();
                        localStorage.setItem(lskey, true);

                        $('.Communities_onboarding_inv_avatar', $element).tool("Users/avatar", {
                            userId: invitingUserId,
                            icon: true
                        }).activate();

                        $('.Communities_onboarding_add_to_pb_btn', $element).plugin('Q/clickable').on(Q.Pointer.fastclick, function () {
                            location.href = Q.url("{{baseUrl}}/Users/" + invitingUserId + ".vcf");
                        });

                        $("button[name=done]", $element).on(Q.Pointer.fastclick, function () {
                            var loggedInUserId = Q.Users.loggedInUserId();
                            Users.getLabels.force(loggedInUserId);
                            Users.getContacts.force(loggedInUserId, null, invitingUserId);
                            $(this).addClass("Q_working");
                            tool.next();
                        });
                    }, {tool: tool});
                });
            }
        }
    },
    {
        next: function (duration) {
            var tool = this;
            var state = this.state;
            Q.Pointer.stopHints();
            Q.Audio.stopSpeaking();
            ++state.current;
            if (duration === undefined) {
                duration = state.duration;
            }
            if (state.current >= state.steps.length) {
                return this.complete();
            }
            var step = state.steps[state.current];
            var handler = state.handlers[step];
            if (!handler) {
                throw new Q.Error("Communities/onboarding refresh: no handler for " + step);
            }
            var $next = $('<div class="Communities_onboarding_step" />');
            $next.addClass('Communities_onboarding_' + step);
            var $showing = $(this.$showing); // may be empty
            if (!$showing.length) {
                $showing = this.$('.Communities_onboarding_showing');
            }
            if (!$showing.length) { // just take the first step
                $showing = this.$('.Communities_onboarding_step');
            }
            $next.hide().insertAfter($showing);
            this.$showing = $next;
            handler.call(this, $next);
            $showing.removeClass('Communities_onboarding_showing');
            state.transition.call(this, $showing, $next, duration, function () {
                Q.removeElement($showing, true);
                _handleUserList(tool, $next);
                $next.addClass('Communities_onboarding_showing');
                tool.$current = $next;
                Q.handle(state.onStep, tool);
            });
        },
        complete: function () {
            var tool = this;
            var state = this.state;

            var inDialog = $(this.element).closest('.Q_overlay')[0];
            return Q.handle(state.onComplete, this, [inDialog]);
        },
        refresh: function () {
            var tool = this;
            var state = this.state;
            var step = state.steps[state.current];
            var handler = state.handlers[step];
            if (!handler) {
                throw new Q.Error("Communities/onboarding refresh: no handler for " + step);
            }
            handler.call(tool, tool.$current);
            _handleUserList(tool, tool.$current);
            Q.handle(state.onStep, tool);
            tool.$showing = tool.$('.Communities_onboarding_step').eq(0);
            tool.$showing.addClass('Communities_onboarding_showing');
            if (state.explanation) {
                var $explanation = $('<div class="Streams_login_explanation">')
                    .html(state.explanation)
                    .hide()
                    .prependTo(tool.element)
                    .slideDown(300);
                state.onStep.set(function () {
                    $explanation.slideUp(300, function () {
                        $explanation.hide();
                    });
                    state.onStep.remove('Communities/onboarding');
                }, 'Communities/onboarding');
            }
        }
    });

function _handleUserList(tool, $element) {
    var $ult = $element.find('.Users_list_tool').show();
    if (Q.info.useFullscreen || !$ult.length) {
        $element.find('.Communities_fade_bottom, .Communities_fade_top').hide();
        return;
    }
    var $te = $(tool.element);
    var $parent = $te.parent();
    var ph = $parent.outerHeight();
    var pt = $parent.offset().top;
    var top = $ult.offset().top;
    $ult[0].style.height = ph - (top - pt) + 'px';
    var ival = setInterval(function () {
        if (!$ult.closest('html').length) {
            clearInterval(ival);
        }
        $ult.scrollTop($ult.scrollTop() + 1);
    }, 100);
}

Q.Template.set('Communities/onboarding/name',
    '<div class="Communities_onboarding_name">'
    + '<img src="{{iconUrl}}" class="Communities_onboarding_logo">'
    + '<h2 class="Communities_onboarding_welcome">'
    + '{{Preface}} {{communityName}}'
    + '</h2>'
    + '{{#if owner}}'
    +	'<div class="Communities_onboarding_narration">{{AsOwner}}</div>'
    + '{{else}}'
    + 	'{{#if admin}}'
    + 		'<div class="Communities_onboarding_narration">{{AsAdmin}}</div>'
    + 	'{{else}}'
    + 		'{{#if member}}'
    + 			'<div class="Communities_onboarding_narration">{{AsMember}}</div>'
    + 		'{{else}}'
    + 			'<div class="Communities_onboarding_narration">{{AsGuest}}</div>'
    + 		'{{/if}}'
    +	 '{{/if}}'
    + '{{/if}}'
    //	+ '<div class="Q_tool Streams_preview_tool Streams_image_preview_tool"></div>'
    + '<form class="Communities_onboarding_name_form" action="">'
    + '{{#if existingName}}'
    + '<button class="Q_button Communities_continue_button" type="button">{{GetStarted}}</button>'
    + '{{else}}'
    + '<input type="text" class="Communities_onboarding_name_fullname" placeholder="{{Placeholder}}">'
    + '{{/if}}'
    + '</form>'
    + '{{#if usersList}}'
    //+ '<div class="Communities_fade_top"></div>'
    //	+ '{{{tool "Users/list" "name"}}}'
    //+ '<div class="Communities_fade_bottom"></div>'
    + '{{/if}}'
    // + '{{{tool "Communities/users" communityId=communityId}}}'
    + '</div>'
);

Q.Template.set('Communities/onboarding/icon',
    '<div class="Communities_onboarding_icon">'
    + '<h2 class="Communities_onboarding_instructions">{{{SetYourPhoto}}}</h2>'
    + '<div class="Q_tool Streams_preview_tool Streams_image_preview_tool"></div>'
    + '<div class="Q_buttons">'
    + '<a class="Communities_onboarding_icon_skip Q_button">{{KeepDefault}}</a>'
    + '</div>'
    + '{{#if usersList}}'
    //+ '<div class="Communities_fade_top"></div>'
    //	+ '{{{tool "Users/list" "icon"}}}'
    //+ '<div class="Communities_fade_bottom"></div>'
    + '{{/if}}'
    + '</div>'
);

Q.Template.set('Communities/onboarding/location',
    '<div class="Communities_onboarding_location">'
    + '{{{tool "Places/user/location"}}}'
    + '<div class="Communities_location_reassure">'
    +	'{{NoOneElse}}'
    + '</div>'
    + '</div>'
);

Q.Template.set('Communities/onboarding/interests',
    '<div class="Communities_onboarding_interests {{secondClass}}">'
    + '<div class="Communities_onboarding_instructions">'
    + '{{{instructions}}}'
    + '</div>'
    + '{{{tool "Streams/interests" skipStreams=true}}}'
    + '<div class="Communities_fade_bottom"></div>'
    + '<div class="Communities_onboarding_next">{{{next}}}</div>'
    + '{{{tool "Q/paging"}}}'
    + '{{{tool "Users/pile"}}}'
    + '</div>'
);

Q.Template.set('Communities/onboarding/profile',
    '<div class="Communities_onboarding_profile {{requiredClass}}">'
    + '<div class="Communities_onboarding_explanation">'
    +   '<div class="Communities_textfill">'
    +	'{{{Profile}}}'
    +   '</div>'
    + '</div>'
    + '{{#if personal}}'
    + '<div class="Q_tool Streams_form_tool Communities_onboarding_profile_basic">'
    + ' {{#if birthday}}{{{Birthday}}}{{/if}}'
    +   '<form action="{{action}}" method="POST">'
    +     '<span class="Communities_onboarding_profile_birthday" data-type="date">{{{birthday}}}</span><br>'
    +     '<span class="Communities_onboarding_profile_gender">{{{gender}}}</span>'
    +     '<span class="Communities_onboarding_profile_height">{{{height}}}</span>'
    +     '<span class="Communities_onboarding_profile_affiliation">{{{affiliation}}}</span>'
    +     '{{#if dating}}'
    +     	'<span class="Communities_onboarding_profile_dating">{{{dating}}}</span>'
    +     '{{/if}}'
    +     '<input type="hidden" name="inputs" value=\'{{value}}\' class="inputs">'
    +   '</form>'
    + '</div>'
    + '{{/if}}'
    + '<div class="Communities_onboarding_profile_greeting">'
    +   '<textarea class="Communities_onboarding_greeting" placeholder="{{Placeholder}}" maxlength="500"></textarea>'
    + '</div>'
    + '<div class="Communities_onboarding_profile_continue">'
    +   '<div class="Communities_onboarding_profile_required">{{Required}}</div>'
    +   '<button class="Q_button Communities_continue_button">{{Done}}</button>'
    + '</div>'
    + '</div>'
);

Q.Template.set('Communities/onboarding/relationships',
    '<div class="Communities_onboarding_relationships">'
    +'<div class="Communities_onboarding_inv_avatar_con">'
    +    '<div class="Communities_onboarding_inv_avatar"></div>'
    +    '<div class="Communities_onboarding_inv_by">{{invitedByUser}}</div>'
    +'</div>'
    +'<div class="Communities_onboarding_explanation">{{explanation}}</div>'
    +'{{{tool "Users/labels" contactUserId=invitingUserId addToPhonebookAtEnd=true}}}'
    +'<button name="done" class="Q_button Communities_continue_button">{{Done}}</button>'
    +'</div>'
);

})(window, Q, Q.jQuery);