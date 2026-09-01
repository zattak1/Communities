/**
 * Communities plugin's front end code
 *
 * @module Communities
 * @class Communities
 */
"use strict";
/* jshint -W014 */
(function (Q, $) {

var Users = Q.Users;
var Streams = Q.Streams;
var Communities = Q.Communities = Q.plugins.Communities = {
	info: {}, // this gets filled when a user logs in
	connected: {}, // check this to see if you are connected to a platform

	selectUserId: function (callback, tool, event) {
		callback({
			userId: Users.loggedInUserId()
		});
	},
	home: {
		related: {
			announcementToolName: function (streamType, options) {
				if (streamType === 'Websites/article') {
					return 'Websites/announcement/preview';
				}
				return streamType + '/preview';
			}
		}
	},
	announcement: {
		url: function (articleId) {
			return Q.url('announcement/' + articleId);
		}
	},
	handlers: {
		cropping: function (dialog) {
			Communities.hints('cropping', [dialog]);
		}
	},
	/**
	 * Return array of communities ids logged user can promote.
	 * Notice: labels for checking loaded from Communities/canPromote config
	 * @method canPromote
	 * @static
	 * @return array
	 */
	canPromote: function () {
		var labelsCanPromote = Q.getObject("labelsCanPromote", Communities);

		if (Q.isEmpty(labelsCanPromote)) {
			return null;
		}

		var communityIds = [];
		// if user canPromote some community, he can promote event to these communities
		Q.each(labelsCanPromote, function () {
			var label = this;
			communityIds = Array.from(new Set(communityIds.concat(Q.getObject(["byRole", label], Communities) || [])));
		});

		var index = communityIds.indexOf(Users.communityId);
		if (index >= 0) {
			communityIds.splice(index, 1);
		}
		index = communityIds.indexOf(Q.info.app);
		if (index >= 0) {
			communityIds.splice(index, 1);
		}

		return communityIds;
	},
	/**
	 * Call this function, preferably synchronously after a user action
	 * so that audio hints would be possible.
	 * @method hints
	 * @static
	 * @param {String} name identifies something that happened
	 * @param {Array} extra any extra info
	 */
	hints: function (name, extra) {
		var liu = Users.loggedInUser;
		var hint = Users.hint;
		var o = {show: {delay: 500}};
		switch (name) {
			case "location":
				var $locationSet = $('.Places_user_location_set');
				if ($locationSet.length && $locationSet.is(':visible')) {
					hint('Communities/location', $locationSet[0], o);
				}
				break;
			case "locationSet":
				var element = $('.Communities_column_location .Q_close')[0];
				hint('Communities/closeColumn', element, o);
				break;
			case "cropping":
				var $dialog = $(extra[0]);
				hint("Communities/cropping", $dialog.find('.Q_close')[0], {
					show: {delay: 5000},
					dontStopBeforeShown: true
				});
				break;
			case "me":
				var $img = $('#Users_avatar_tool .Users_avatar_icon');
				var $interests = $('.Communities_account_interests');
				var $profile = $('.Communities_account_profile');
				var fb = (liu && liu.signedUpWith === 'facebook');
				(!fb && hint("Communities/icon", $img[0], o))
				|| hint("Communities/interests", $interests[0], o)
				|| hint("Communities/profile", $profile[0], o)
				|| hint("Communities/events", '.Q_tab_events', o);
				break;
			case "wasInvited":
				var oic = Streams.onInviteComplete;
				var $input = $('#Streams_login_username');
				if ($input.length && $input.is(':visible')) {
					if (Q.info.isTouchscreen) {
						hint('Communities/invite/username', $input[0]);
					}
					$input.plugin('Q/clickfocus');
					Streams.onInvitedUserAction.set(function () {
						Communities.hints('openedEvent');
					}, 'Q.Communities.hint');
				}
				break;
			case "openedEvent":
				var lls = Q.Text.languageLocaleString;
				var u1 = '{{Communities}}/audio/event/';
				var u2 = lls+'.m4a';
				var delay = Q.getObject(["hints", "info", u1, u2, "delay"], Communities) || 9000;
				hint('Communities/event/invited', '.Calendars_going>*', {
					// audio: {src: u1+u2},
					show: {delay: delay},
					dontStopBeforeShown: true
				});
				break;
			case "goingNo":
				break;
			case "goingYes":
				var $column = extra[0];
				var $curtain = $column.find('.Calendars_event_curtain');
				if (Q.info.isTouchscreen) {
					o.src = '{{Q}}/img/hints/swipe-up.gif';
					hint('Communities/chat/open', $curtain[0], o);
				}
				break;
			case "chatOpened":
				var ds = extra[1];
				var $column = extra[0];
				if (Q.info.isTouchscreen) {
					hint('Communities/chat/close', ds.$placeholder[0], {
						src: '{{Q}}/img/hints/swipe-up.gif'
					});
				} else {
					var $trigger = $column.find('.Q_drawers_trigger');
					hint('Communities/chat/close', $trigger[0]);
				}
				break;
			case "chatClosed":
				var $column = extra[0];
				var $expand = $column.find('.Streams_participants_expand:visible');
				var $label = $column.find('.Streams_invite_label');
				var hintElement = $expand[0] || $label[0];
				hint('Communities/invite', hintElement, o);
				break;
			case "invitedSomeone":
				var $column = extra[0];
				var $close = $column.find('.Q_close');
				hint('Communities/event/close', $close[0], {
					show: {delay: 3000}
				});
				break;
			case "events":
				var newEvent = $('#Communities_new_event_button')[0];
				hint('Communities/newEvent', newEvent, {
					show: {delay: 2000}
				});
				break;
		}
	},
	conversationsPredefine: function () {
		var _onMessage = function(){
			var tool = this;
			var ps = Q.getObject(["preview", "state"], this);

			if (!ps) {
				return;
			}

			var $toolElement = $(tool.element);

			//console.log(ps.state.publisherId);
			Streams.Stream.onMessage(ps.publisherId, ps.streamName, 'Streams/chat/message')
			.set(function() {
				// add highlighted class
				$toolElement.addClass("Q_newsflash");

				// remove class when transaction ended
				$toolElement.one('webkitAnimationEnd oanimationend msAnimationEnd animationend', function(e) {
					$toolElement.removeClass("Q_newsflash");
				});

				// move tool top of parent
				$toolElement.parent().prepend($toolElement);
			}, tool);
		};

		var _chatOnActivate = function () {
			if (Q.typeOf(this) !== 'Q.Tool') {
				return;
			}

			// set onMessage for future tools
			Q.handle(_onMessage, this);

			this.state.onInvoke.set(function (preview) {
				Communities.pushConversationColumn(
					preview.state.publisherId, preview.state.streamName
				);
			});
		};
		// set onMessage for tools already activated
		$(".Streams_chat_preview_tool").each(function(){
			// set onMessage for current tools
			Q.handle(_chatOnActivate, Q.Tool.from(this, "Streams/chat/preview"));
		});
		// set onMessage for future tools
		Q.Tool.onActivate('Streams/chat/preview').add(_chatOnActivate, true);

		var _webpagePreviewOnActivate = function () {
			if (Q.typeOf(this) !== 'Q.Tool') {
				return;
			}

			// this happen when user click on preview tool element
			this.state.onInvoke.set(function () {
				if ($(this.element).closest('.Communities_profile[data-val=links]').length) {
					window.open(this.state.url, '_blank');
				} else if (!$(this.element).closest('.Websites_webpage_composer_tool').length) {
					Communities.pushConversationColumn(
						this.state.publisherId, this.state.streamName, this.element
					);
				}
			}, this);
		};
		// set handler for Websites/webpage/preview tools already activated
		$(".Websites_webpage_preview_tool").each(function(){
			// set onMessage for current tools
			Q.handle(_webpagePreviewOnActivate, Q.Tool.from(this, "Websites/webpage/preview"));
		});
		// set handler for Websites/webpage/preview future tool
		Q.Tool.onActivate('Websites/webpage/preview').add(_webpagePreviewOnActivate, true);
	},
	pushPresentationColumn: function (stream, $trigger, options) {
		Q.addStylesheet("{{Communities}}/css/columns/presentation.css", {slotName: 'Communities'});
		var relationType = 'Media/presentations';
		stream.relatedTo(relationType, {
			limit: 1
		}, function (err) {
			if (err) {
				console.error(err)
				return;
			}
			var presentation = Q.first(this.relatedStreams);
			if (presentation) {
				return _showColumnWith(presentation);
			}

			if (!Q.Users.loggedInUser) {
				return;
			}
			Streams.create({
				publisherId: stream.fields.publisherId,
				type: 'Media/presentation',
				title: stream.fields.title
			}, function (err, stream) {
				if (err) {
					console.error(err)
					return;
				}
				_showColumnWith(stream);
			}, {
				publisherId: stream.fields.publisherId,
				streamName: stream.fields.name,
				type: relationType,
				inheritAccess: true
			});
		});
		function _showColumnWith(presentation) {
			$trigger = $($trigger || this.element);
			Communities.latestTrigger = $trigger[0];
			var publisherId = presentation.fields.publisherId;
			var streamName = presentation.fields.name;
			var min = parseInt($trigger.closest('.Q_columns_column').data('index')) + 1;
			var columns = Q.Tool.from($trigger.closest(".Q_columns_tool"), "Q/columns") || Q.Tool.byId("Q_columns-Communities");
			columns.close({min: min}, null, {animation: {duration: 0}});
			columns.push({
				title: "Presentation",
				column: '<div class="Communities_presentation_title"></div><div class="Communities_presentation_instructions"></div><div class="Communities_presentation_chat"></div>',
				columnClass: 'Communities_column_presentation',
				onActivate: function (element, options, index, data) {
					Q.Text.get('Media/content', function (err, text) {
						var instructionsText = Q.getObject("presentation.PutTogether", text);
						if (instructionsText) {
							$('.Communities_presentation_instructions', element).text(instructionsText);
						}
					});
					$('.Communities_presentation_title', element).tool('Streams/inplace', {
						publisherId: publisherId,
						streamName: streamName,
						field: 'title'
					}).activate();
					// if (presentation.fields.type === 'Media/presentation') {
					// 	var url = ['presentation', publisherId, streamId].join('/');
					// 	Q.Page.push(url);
					// }

					// try to preload related tools
					Q.Streams.Tool.preloadRelated(publisherId, streamName, element);

					$('.Communities_presentation_chat', element).tool('Streams/chat', Q.extend({}, options, {publisherId, streamName})).activate(function () {
						Streams.Message.Total.seen(publisherId, streamName, 'Streams/chat', true);
						Q.scrollIntoView($trigger[0], {
							behavior: 'smooth',
							block: 'center',
							unlessOffscreenHorizontally: true
						});

						var tool = this;
						tool.state.onRefresh.set(function () {
							Q.Users.hint(
								'Communities/presentation/addItems',
								this.$('.Streams_chat_addons'),
								{
									show: {
										delay: 1000
									}
								}
							);
						});

						tool.element.forEachTool('Streams/preview', function () {
							var state = this.state;
							state.onInvoke.set(function () {
								Q.Streams.Stream.ephemeral(publisherId, streamName, {
									type: "Media/presentation/show",
									publisherId: state.publisherId,
									streamName: state.streamName
								});
							}, this);
						}, tool);

						tool.element.forEachTool("Streams/pdf/preview", function () {
							var previewTool = this;
							var previewState = this.preview.state;

							document.body.forEachTool("Q/pdf", function () {
								if (Q.isEmpty(previewTool.stream) || Q.url(previewTool.stream.fileUrl()) !== this.state.url) {
									return;
								}

								this.state.onScroll.set(function (scrollTop, scrollLeft) {
									Q.Streams.Stream.ephemeral(previewState.publisherId, previewState.streamName, {
										type: "Streams/scroll",
										scrollTop,
										scrollLeft
									});
								}, previewTool);
								this.state.onSlide.set(function (slideIndex) {
									Q.Streams.Stream.ephemeral(previewState.publisherId, previewState.streamName, {
										type: "Streams/slide",
										slideIndex
									});
								}, previewTool);
							}, previewTool);
						}, tool);

						tool.element.forEachTool("Streams/video/preview", function () {
							var previewTool = this;
							var previewState = this.preview.state;

							document.body.forEachTool("Q/video", function () {
								if (Q.isEmpty(previewTool.stream) || Q.url(previewTool.stream.fileUrl()) !== this.state.url) {
									return;
								}
								this.state.onPlay.set(function (pos) {
									Q.Streams.Stream.ephemeral(previewState.publisherId, previewState.streamName, {
										type: "Streams/play",
										pos
									});
								}, previewTool);
								this.state.onPause.set(function (pos) {
									Q.Streams.Stream.ephemeral(previewState.publisherId, previewState.streamName, {
										type: "Streams/pause",
										pos
									});
								}, previewTool);
								this.state.onSeek.set(function (pos) {
									Q.Streams.Stream.ephemeral(previewState.publisherId, previewState.streamName, {
										type: "Streams/seek",
										pos
									});
								}, previewTool);
							}, previewTool);
						}, tool);

						tool.element.forEachTool("Streams/audio/preview", function () {
							var previewTool = this;
							var previewState = this.preview.state;

							document.body.forEachTool("Q/audio", function () {
								if (Q.isEmpty(previewTool.stream) || Q.url(previewTool.stream.fileUrl()) !== this.state.url) {
									return;
								}

								this.state.onPlay.set(function (pos) {
									Q.Streams.Stream.ephemeral(previewState.publisherId, previewState.streamName, {
										type: "Streams/play",
										pos
									});
								}, previewTool);
								this.state.onPause.set(function (pos) {
									Q.Streams.Stream.ephemeral(previewState.publisherId, previewState.streamName, {
										type: "Streams/pause",
										pos
									});
								}, previewTool);
								this.state.onSeek.set(function (pos) {
									Q.Streams.Stream.ephemeral(previewState.publisherId, previewState.streamName, {
										type: "Streams/seek",
										pos
									});
								}, previewTool);
							}, previewTool);
						}, tool);
					});
				}
			});
		}
	},
	pushChatColumn: function (stream, $trigger, options) {
		Q.Streams.get(stream.fields.publisherId, stream.fields.name, async function (err, stream) {
			if (err) {
				return
			}
			$trigger = $($trigger || this.element);
			Communities.latestTrigger = $trigger[0];
			var publisherId = this.fields.publisherId;
			var streamName = this.fields.name;
			var min = parseInt($trigger.closest('.Q_columns_column').data('index')) + 1;
			var columns = Q.Tool.from($trigger.closest(".Q_columns_tool"), "Q/columns") || Q.Tool.byId("Q_columns-Communities");
			//var streamId = streamName.split('/').pop();
			columns.close({min: min}, null, {animation: {duration: 0}});
			var text = await Q.Text.get('Communities/content');
			columns.push({
				title: text.conversations.Conversation,
				column: Q.Tool.setUpElement('div', 'Streams/chat', Q.extend({}, options, {
					publisherId: publisherId,
					streamName: streamName
				})),
				columnClass: 'Communities_column_chat',
				controls: Q.Tool.setUpElement('div', 'Streams/participants', {
					publisherId: publisherId,
					streamName: streamName,
					invite: stream.inviteIsAllowed() ? {
						readLevel: stream.access.readLevel, // grant own readLevel
						writeLevel: stream.access.writeLevel, // grant own writeLevel
						addLabel: [],
						addMyLabel: []
					} : null,
					showSummary: false,
					maxShow: 6
				}),
				onActivate: function () {
					// if (stream.fields.type === 'Communities/event') {
					// 	var url = ['chat', publisherId, streamId].join('/');
					// 	Q.Page.push(url);
					// }
					Streams.Message.Total.seen(publisherId, streamName, 'Streams/chat', true);
				}
			});
		});
	},
	promoteEvent: function (stream, $trigger) {
		var relationType = 'Calendars/events';
		var experienceId = 'main';
		Q.Text.get('Communities/content', function (err, content) {
			// create array of unique communities from byRole["Users/owners"] and byRole["Users/admins"]
			var communityIds = Communities.canPromote();
			if (!communityIds) {
				return;
			}

			Q.Dialogs.push({
				className: 'Communities_promote_dialog',
				title: content.event.promote.Title,
				template: {
					name: 'Communities/promote/dialog',
					fields: {
						communityIds: communityIds,
						stream: stream
					}
				},
				onActivate: function (dialog) {
					$('.Communities_promote_button', dialog)
						.plugin('Q/clickable')
						.on(Q.Pointer.click, function () {
							var communityId = $(this).attr('data-communityid');
							Q.req('Streams/promote', ['relations'], function (err, data) {
								Q.Dialogs.pop();
								var fem = Q.firstErrorMessage(err, data);
								if (fem) {
									return Q.alert("Error posting event: " + fem);
								}
							}, {
								method: 'post',
								fields: {
									communityId: communityId,
									publisherId: stream.fields.publisherId,
									streamName: stream.fields.name,
									experienceId: experienceId,
									relationType: relationType
								}
							});
						});
				}
			});
		});
	},
	pushConversationColumn: function (publisherId, streamName, $trigger, callback) {
		$trigger = $($trigger || this.element);
		Communities.latestTrigger = $trigger[0];
		Q.Streams.get(publisherId, streamName, function (err, data) {
			var fem = Q.firstErrorMessage(err, data);
			if (fem) {
				return Q.alert(fem);
			}
			
			var stream = this;
			var columns = Q.Tool.from($trigger.closest(".Q_columns_tool"), "Q/columns") || Q.Tool.byId('Q_columns-Communities');
			var min = parseInt($trigger.closest('.Q_columns_column').data('index')) || 0;
			min++;
			columns.close({min: min}, null, {animation: {duration: 0}});
			columns.push({
				title: stream.fields.title,
				template: 'Communities/templates/conversation',
				columnClass: 'Q_column_' + Q.normalize(stream.fields.type),
				fields: {
					'Streams/chat': {
						publisherId: publisherId,
						streamName: streamName
					},
					'Users/avatar': {
						userId: publisherId,
						icon: true
					},
					stream: stream.fields,
					content: stream.fields.content.encodeHTML()
				},
				name: 'conversation',
				controls: Q.Tool.setUpElement('div', 'Streams/participants', {
					publisherId: publisherId,
					streamName: streamName,
					invite: stream.inviteIsAllowed() ? {
						readLevel: stream.access.readLevel, // grant own readLevel
						writeLevel: stream.access.writeLevel, // grant own writeLevel
						addLabel: [],
						addMyLabel: []
					} : null,
					showSummary: false,
					maxShow: 6
				}),
				pagePushUrl: 'conversation/' + publisherId + '/' + Q.normalize(streamName)
			}, callback);
		});
	},
	navigate: function (dest, callback, updateNav) {
		if (!dest) return false;
		var parts = dest.split('/');
		if (parts[0] === 'event') {
			var publisherId = parts[1];
			var eventId = parts[2];
			var url = Q.url("event/" + publisherId + "/" + eventId);
			var streamName = 'Calendars/event/' + eventId;
			Streams.get(publisherId, streamName, function (err) {
				var fem = Q.firstErrorMessage(err);
				if (fem) {
					return Q.alert(fem);
				}
				var stream = this;
				var columns = Q.Tool.byId("Q_columns-Communities");
				if (columns.state.$currentColumn.hasClass('Communities_column_event')) {
					columns.pop(null, {animation: {duration: 0}});
				}

				var classNames = ['Communities_column_event'];
				if (Q.getObject('Q.Communities.event.mode') === 'reservation') {
					classNames.push('Communities_event_reservation');
				}
				if (Q.getObject("Assets.service.relatedParticipants", Q)) {
					classNames.push('Communities_event_relatedParticipants');
				}

				columns.push({
					column: Q.Tool.setUpElement('div', 'Calendars/event', {
						stream: stream
					}),
					activateOptions: {
						".Q_drawers_tool": {
							initial: {
								delay: columns.state.delay
							}
						}
					},
					name: 'event',
					title: stream.fields.title,
					columnClass: classNames.join(' '),
					pagePushUrl: url,
					afterDelay: function () {
						// $('.Communities_badge').plugin('Communities/badge');
						Communities.onEvent('').handle();
					},
					beforeClose: function (index, indexAfterClose, div) {
						// if (div.hasClass('Communities_column_event')) {
						// 	// TODO: went back to the event?
						// }
					}
				}, columns.max());
			});
			Communities.hints('openedEvent');
			return false;
		}
		switch (dest) {
			case 'events':
			case 'local':
			case 'people':
			case 'community':
			case 'me':
				var tool = Q.Tool.byId('Q_tabs-nav');
				if (tool.state.tabName === dest) {
					return Q.handle(callback, tool);
				}
				var options = {
					onActivate: callback
				};
				if (updateNav) {
					options.slotNames = {
						replace: Communities.slotNames.concat(['dashboard'])
					};
				}
				tool.switchTo(dest, options);
				return false;
			case 'me/time':
			case 'me/location':
			case 'me/interests':
			case 'me/profile':
			case 'me/business':
				Communities.navigate('me', function () {
					Communities.me.handle(dest.split('/')[1]);
				}, updateNav);
				return false;
			case 'focus':
				$(':input').eq(0).plugin('Q/clickfocus');
				return false;
			default:
				break;
		}
	},
	openUserProfile: function (userId) {
		var columns = Q.Tool.byId("Q_columns-Communities") || Q.Tool.from($(this).closest(".Q_tool.Q_columns_tool"), "Q/columns");

		if (!columns) {
			return;
		}
		var index = $(this).closest('.Q_columns_column').data('index') || 0;
		if (columns.state.$currentColumn.hasClass('Communities_column_profile')) {
			if ($(this).closest(columns.state.$currentColumn[0]).length) {
				--index; // this column itself was popped
			}
			columns.pop(null, {animation: {duration: 0}});
		}
		var o = {
			name: 'profile',
			url: Q.url('profile/' + userId),
			onFillSlots: function (elements) {
				var img = elements.column.querySelector('.Users_avatar_tool img');
				if (img && !img.getAttribute('data-lazyload-src')) {
					Q.Visual.awaitNaturalImageSize(img, function (w, h) {
						img.style.height = img.getBoundingClientRect().width
							* h / w + 'px';
					});
				}
			},
			columnClass: 'Communities_column_profile'
		};
		if (index !== null) {
			columns.open(o, index + 1);
		} else {
			columns.push(o);
		}
		Q.addStylesheet('{{Communities}}/css/columns/profile.css', { slotName: 'Communities' });
	},
	openCommunityProfile: function (userId) {
		var columns = Q.Tool.byId("Q_columns-Communities");
		if (!columns) {
			return;
		}
		var index = $(this).closest('.Q_columns_column').data('index') || 0;
		if (columns.state.$currentColumn.hasClass('Communities_column_community')) {
			columns.pop(null, {animation: {duration: 0}});
		}
		var o = {
			name: 'community',
			url: Q.url('community/' + userId),
			columnClass: 'Communities_column_community'
		};
		if (index !== null) {
			columns.open(o, index + 1);
		} else {
			columns.push(o);
		}
	},
	getChatMessages: function (publisherId, streamName) {
		var options = Q.Tool.define.options('Streams/chat') || {};
		var params = {
			max: -1,
			limit: options.messagesToLoad,
			type: "Streams/chat/message",
			withMessageTotals: ["Streams/chat/message"]
		};
		Streams.retainWith('Communities').get(publisherId, streamName);
		Streams.Message.get(publisherId, streamName, params);
	},
	eventClose: function (eventStream) {
		var columns = Q.Tool.byId('Q_columns-Communities');
		var $column = $(this.element).closest('.Q_columns_column');
		if ($column.length) {
			var index = parseInt($column.data('index'));
			columns.close(index, null, {animation: {duration: 0}});
		}
	},
	pushTripColumn: function (tripStream, trigger) {
		var $trigger = $(trigger || this.element);
		Communities.latestTrigger = $trigger[0];
		var tripId = tripStream.fields.name.split('/').pop();
		var columns = Q.Tool.from($trigger.closest(".Q_columns_tool"), "Q/columns") || Q.Tool.byId('Q_columns-Communities');
		if (Q.typeOf(this) === 'Q.Tool' && this.name === 'travel_trips') {
			$trigger = $(this.element);
		}
		if ($trigger.length) {
			var $column = $trigger.closest('.Q_columns_column');
			if ($column.length) {
				var min = parseInt($column.data('index')) + 1;
				columns.close({min: min}, null, {animation: {duration: 0}});
			}
		}

		Q.addStylesheet('{{Communities}}/css/columns/trip.css', { slotName: 'Communities' });

		var url = Q.url(['trip', tripStream.fields.publisherId, tripId].join('/'));
		columns.push({
			title: tripStream.fields.title,
			name: "trip",
			columnClass: 'Communities_column_trip',
			url: url,
			pagePushUrl: url,
			data: {
				publisherId: tripStream.fields.publisherId,
				streamName: tripStream.fields.name
			}
		});
	},
	appButton: function () {
		Q.Text.get('Communities/content', function (err, text) {
			var $button = $('.Communities_app_button');
			var url = Q.getObject(
				[Q.info.platform, Q.info.app, 'url'],
				Q.getObject("Users.apps", Q)
			);

			// if cordova app using - remove this button
			// if url absent - remove this button too, because nowhere to redirect
			if (Q.getObject("info.isCordova", Q) || !url) {
				return $button.remove();
			}

			$button.plugin('Q/clickable')
			.off(Q.Pointer.fastclick)
			.on(Q.Pointer.fastclick, function () {
				var alertText = Q.getObject("people.AppAlert", text);
				if(alertText) {
					alert(alertText);
				}
				Q.handle(url);
			});			
		});
	},
	registerDevice: function () {
		Users.Device.subscribe(function(err, subscribed){
			var fem = Q.firstErrorMessage(err);
			if (fem) {
				console.error("Device registration: " + fem);
				return false;
			}

			if(subscribed) {
				console.log("device subscribed");
			} else {
				console.log("device failed to subscribe");
			}
		});
	},
	startOnboarding: function (callback, options) {
		// Callers pass very different second arguments. Streams.onInviteResolved
		// passes {communityId: ...}; Users.login's onRequireComplete passes the
		// logged-in USER (login.js does
		// Q.handle(o.onRequireComplete, this, [_onComplete, user, response2, o])).
		// Only treat a plain object as tool options, so a Users.User doesn't get
		// spread into them.
		var toolOptions = (options && options.constructor === Object)
			? options : {};
		// The old sessionCount > 1 bail made "existing user invited into a new
		// community" impossible -- which is exactly the case onboarding is for.
		// The onboarding tool already skips steps that are filled in, so a
		// complete user completes immediately.
		if (!Q.Users.loggedInUser) {
			return Q.handle(callback);
		}
		// Guard against running twice for the same user in the same session.
		// After registration: onRequireComplete fires startOnboarding, then
		// after the invite dialog resolves, onInviteResolved fires it again.
		// The second call should just run the callback. But a different user
		// (logout + login, or a new registration) must be able to onboard.
		var uid = Q.Users.loggedInUserId();
		var cid = toolOptions.communityId || Q.Users.currentCommunityId;
		var key = uid + '\t' + cid;
		if (Communities._onboardedKey === key) {
			return Q.handle(callback);
		}
		Communities._onboardedKey = key;

		Q.Text.get("Communities/content", function (err, text) {
			Q.Dialogs.push({
				title: text.onboarding.Title,
				className: "Communities_onboarding_overlay",
				content: $("<div>").tool("Communities/onboarding", Q.extend({
					communityId: Q.Users.currentCommunityId
				}, toolOptions)),
				noClose: true,
				onActivate: function (dialog) {
					var onboardingTool = Q.Tool.from($(".Communities_onboarding_tool", dialog)[0], "Communities/onboarding");
					if (!onboardingTool) {
						return console.warn("Communities.startOnboarding: onboarding tool not found");
					}

					if (typeof callback === 'function') {
						onboardingTool.state.onComplete.set(callback, 'Communities.startOnboarding');
					}
				}
			});
		});
	},
	keymap: {
		'1': 'events',
		'2': 'local',
		'3': 'people',
		'4': 'me',
		'l': 'me/location',
		'i': 'me/interests',
		'a': 'me/profile',
		'Return': 'focus'
	},
	onEvent: Q.Event.factory(null, [''])
};

Q.page("Communities/home", function () {
	$('.Communities_account_identifier')
		.click(function () {
			Users.setIdentifier({
				identifierType: $(this).attr('data-type'),
				onSuccess: location.href
			});
			return false;
		}).each(function () {
		// prevent browsers from auto-highlighting phone numbers
		var $a = $(this).find('.Communities_identifier a');
		setTimeout(function () {
			$('<div />').html($a.html()).insertAfter($a);
			$a.remove();
		}, 0);
	});

	$('#Communities_logout').tool('Q/clickable', {
		onInvoke: function (evt, overElement) {
			Users.logout();
		}
	}).activate();
});

Q.page('', function (unload, url, o) {
	_handleScroll(Q.Tool.byId('Q_columns-Communities'));

	Communities.appButton();

	$('.Communities_top_controls input').on('focus', function () {
		$('.Communities_top_controls button').hide();
	}).on('blur', function () {
		$('.Communities_top_controls button').show();
	});

	var drawers = Q.Tool.byId('Q_drawers');

	if (Users.loggedInUser) {
		Streams.Stream.retain(Users.loggedInUser.id, 'Streams/user/icon', 'Communities');
	}
	$('.Communities_login').on(Q.Pointer.fastclick, function (e) {
		if (Q.info.isCordova && window.Groups && Groups.Cordova) {
			Groups.Cordova.showFullscreen();
		}
		Users.login();
		e.preventDefault();
		return false;
	});
	$('.Communities_logout').on(Q.Pointer.fastclick, function (e) {
		Users.logout();
		e.preventDefault();
	});
	// if (!o || !o.slotNames || o.slotNames.indexOf('nav') >= 0) {
	// 	$('#Q_tabs-nav_tool img').plugin('Q/clickable', {
	// 		triggers: function () {
	// 			return this.parent();
	// 		},
	// 		shadow: {
	// 			dip: 0.25
	// 		},
	// 		press: {
	// 			size: 1.5
	// 		},
	// 		release: {
	// 			size: 3
	// 		},
	// 	});
	// }
	if (Q.info.isTouchscreen) {
		var c = $('.Communities_preventSelections')[0];
		if (c) {
			c.preventSelections();
		}
	}

	$('body').on(Q.Pointer.fastclick, '.Calendars_event_preview_tool', true,
		function (event) {
			var $this = $(this);
			var $trigger = $this;
			Communities.latestTrigger = $trigger[0];
			var drawers = Q.Tool.byId("Q_drawers");
			if ($this.closest('.Q_drawers-drawer_1').length
				&& drawers && drawers.state.currentIndex === 0) {
				return;
			}
			var tool = this.Q("Calendars/event/preview");
			var ps = tool.preview.state;
			var publisherId = ps.publisherId;
			var eventId = ps.streamName.split('/').pop();
			var columns = Q.Tool.byId("Q_columns-Communities");
			var min = parseInt($trigger.closest('.Q_columns_column').data('index')) + 1;
			columns.close({min: min}, null, {animation: {duration: 0}}, true);
			Communities.navigate('event/' + publisherId + '/' + eventId);
			return false;
		});

	if ($('html').hasClass('Q_layout_sidebar')) {
		// set max-height of dashboard Q_tabs_tool on desktop
		// to parent height minus sum heights of all visible siblings
		$(".Q_notMobile #dashboard > .Q_tabs_tool").css('max-height', function () {
			var $this = $(this);
			var siblingsSum = 0;

			$(this).siblings("*:visible").each(function () {
				siblingsSum += $(this).outerHeight(true);
			});

			return ($this.parent().innerHeight() - siblingsSum) + 'px';
		});
	}

	Q.layout();

	return function () {
		var columns = Q.Tool.byId("Q_columns-Communities");
		if (columns) {
			columns.close({min: 1}, null, {
				animation: {duration: 0},
				pagePushUrl: false
			});
		}
	};
});

Q.Tool.onActivate("Calendars/event").set(function () {
	var tool = this;
	tool.state.onRefresh.set(function () {
		Q.Users.hint(
			'Communities/presentation/eventSection',
			tool.$('.Streams_aspect_presentation')
		);
	});
}, "Communities");

Q.Tool.onActivate("Calendars/event/composer").set(function () {
	this.state.onCreate.set(function (stream) {
		var columns = Q.Tool.byId('Q_columns-Communities');
		if (!columns) {
			return;
		}
		var sf = stream.fields;
		var eventId = sf.name.split('/').pop();
		columns.close({min: columns.max()});
		Communities.navigate('event/' + sf.publisherId + '/' + eventId);
	});
}, 'Communities');

Q.Tool.onActivate("Calendars/service/browser").set(function () {
	this.state.onCreate.set(function (stream) {
		var columns = Q.Tool.byId('Q_columns-Communities');
		if (!columns) {
			return;
		}
		var sf = stream.fields;
		var eventId = sf.name.split('/').pop();
		columns.close({min: columns.max()});
		Communities.navigate('event/' + sf.publisherId + '/' + eventId);
	});
}, 'Communities');

Q.Tool.onActivate("Communities/conversation/composer").set(function () {
	this.state.onCreate.set(function (stream) {
		var sf = stream.fields;
		//Q.handle(Q.url("conversations/"+sf.publisherId+"/" + sf.name.split('/').pop()));
		Communities.pushConversationColumn(sf.publisherId, sf.name);
	});
}, 'Communities');

// Runs whether they accepted or declined, and on the server-side auto-accept
// path where no dialog was ever shown.
Streams.onInviteResolved.set(function (accepted, params) {
	Communities.startOnboarding(null, {
		communityId: params && params.communityId
	});
}, 'Communities');

Users.login.options.onRequireComplete.set(Communities.startOnboarding, 'Communities');

// Q.Assets.preSubscribeLogin.set(Communities.startOnboarding, 'Communities');

Communities.usersAvatarSelector = [
	'.Streams_participants_container .Users_avatar_tool',
	'.Communities_people_content .Users_avatar_tool',
	'.Users_list_tool .Users_avatar_tool',
	'.Media_feeds_access .Users_avatar_tool',
	'.Streams_preview_tool .Users_avatar_tool',
	'.Communities_conversation_container .Users_avatar_tool',
	'.Streams_chat_tool .Users_avatar_tool'
];
Communities.usersAvatarSelector = Communities.usersAvatarSelector.join(',');

// Do something when
Q.Tool.onActivate("id:Q_columns-Communities").set(function () {
	var columns = this;
	columns.state.beforeClose.set(function (index, prevIndex, column) {
		if (!$(column).is(":visible")) {
			return;
		}

		Q.Audio.pauseAll();
		Q.Video.pauseAll();
	});
	columns.state.onClose.set(function (index, column, data) {
		if (Q.Page.beingProcessed) {
			return;
		}

		// show any placeholders that may have been skipped while column was hidden
		$('input').trigger('Q_refresh');
		var href, tab;
		var data = this.data(Q.getObject("state.currentIndex", this));
		var publisherId = Q.getObject("publisherId", data);
		var eventId = Q.getObject("eventId", data);
		if (publisherId && eventId) {
			// this is an event column
			href = Q.url(['event', publisherId, eventId].join('/'));
		} else {
			var tabsTool = Q.Tool.byId('Q_tabs-Communities');
			if (tabsTool) {
				tab = tabsTool.state.tab;
				href = tab && $('a', tab).attr('href');
			}
		}
		if (!column.hasClass('Communities_column_event')) {
			return;
		}

		Streams.release('Communities');
	}, 'Communities');

	columns.state.onActivate.set(function (options, index, column, data) {
		_handleScroll(columns);
		_handleHints(columns);
		$(this.state.columns[index]).plugin('Q/placeholders');

		if (!Q.info.isMobile) {
			setTimeout(function () {
				$(Communities.latestTrigger).addClass('Q_selected')
				.siblings().removeClass('Q_selected');
				Q.scrollIntoView(Communities.latestTrigger, {
					behavior: 'smooth',
					block: 'nearest',
					unlessOffscreenHorizontally: true
				});
			}, 300);
		}
	}, 'Communities');

	columns.state.beforeClose.set(Q.preventRecursion(
		'Communities.columns.beforeClose',
		function (index) {
			Q.each(index + 1, columns.state.columns.length - 1, 1, function (i) {
				columns.close(i);
			});
		}
	), 'Communities');

	// If someone clicks on avatars in certain contexts, open their profile
	// Only consume the gesture when a columns tool can actually open a profile;
	// otherwise leave the event alone so other handlers (e.g. page click) can run.
	$('body').off(Q.Pointer.fastclick, Communities.usersAvatarSelector).on(Q.Pointer.fastclick, Communities.usersAvatarSelector, function (e) {
		var columns = Q.Tool.byId("Q_columns-Communities")
			|| Q.Tool.from($(this).closest(".Q_tool.Q_columns_tool"), "Q/columns");
		if (!columns) {
			return;
		}
		e.stopPropagation();
		var userId = this.Q('Users/avatar').state.userId;
		if (!userId) {
			return;
		}

		if (Users.isCommunityId(userId)) {
			Communities.openCommunityProfile.call(this, userId);
		} else {
			Communities.openUserProfile.call(this, userId);
		}
		return false;
	});
}, 'Communities');

Q.Tool.onActivate('Travel/trips').set(function () {
	var trips = this;
	trips.state.onInvoke && trips.state.onInvoke.set(Communities.pushTripColumn, trips);
}, 'Communities');

Q.Tool.onActivate('Travel/trip/preview').add(function () {
	this.state.onInvoke.set(function () {
		Communities.pushTripColumn(this.state.stream, this.element);
	});
}, 'Communities');

Q.Tool.onActivate('Streams/chat').add(function () {
	var column = $(this.element).closest(".Q_columns_column");
	var columnIndex = column.length && column.data("index");
	var columns = Q.Tool.byId('Q_columns-Communities');
	var tool = this;

	// check if onClose event exist and tool inside a column
	if (Q.getObject(["state", "onClose"], tool) && columnIndex) {
		tool.state.onClose.set(function (stream) {
			// close column with Streams/chat tool
			columns.close(columnIndex, null, {animation: {duration: 0}});
		});
	}
	Q.addStylesheet("{{Communities}}/css/columns/conversations.css");
}, 'Communities');

Q.Tool.onActivate('Q/tabs').add(function () {
	// only for main Q/tabs tool from dashboard
	if (this.id !== 'Q_tabs-Communities') {
		return;
	}

	this.state.onCurrent.set(function (tab, name) {
		if (tab) {
			// set dashboard h1 title to current page title
			$("#dashboard h1").html($(tab).text() || name);
		}
	}, 'Communities');

	this.state.beforeRefresh.set(function (indicate) {
		var columns = Q.Tool.byId('Q_columns-Communities');
		if (!columns) {
			return;
		}
		var current = columns.column(0).getAttribute('data-name');
		indicate(current);
	}, 'Communities');
}, 'Communities');

Q.Tool.onActivate('Calendars/availability/preview').set(function () {
	this.state.onProfile && this.state.onProfile.set(Communities.openUserProfile, 'Communities');
}, 'Communities');

Q.Text.addFor(
	['Q.Tool.define', 'Q.Template.set'],
	'Communities/', ["Communities/content"]
);
Q.Tool.define({
	"Communities/conversation/preview": "{{Communities}}/js/tools/conversation/preview.js",
	"Communities/conversation/composer": "{{Communities}}/js/tools/conversation/composer.js",
	"Communities/announcement/preview": "{{Communities}}/js/tools/announcement/preview.js",
	"Communities/relate": "{{Communities}}/js/tools/relate.js",
	"Communities/occupants": "{{Communities}}/js/tools/occupants.js",
	"Communities/invitation": "{{Communities}}/js/tools/invitation.js",
	"Communities/onboarding": {
		"css": "{{Communities}}/css/tools/onboarding.css",
		"js": "{{Communities}}/js/tools/onboarding.js"
	},
	"Communities/users": "{{Communities}}/js/tools/users.js",
	"Communities/unseen": "{{Communities}}/js/tools/unseen.js",
	"Communities/composer": "{{Communities}}/js/tools/composer.js",
	"Communities/importusers": {
		js: "{{Communities}}/js/tools/importusers.js",
		css: "{{Communities}}/css/importusers.css"
	},
	"Communities/select": "{{Communities}}/js/tools/select.js",
	"Communities/columnFBStyle": "{{Communities}}/js/tools/columnFBStyle.js",
	"Communities/profile/summary": function () {},
	"Communities/roles": {
		"js": "{{Communities}}/js/tools/roles.js",
		"css": "{{Communities}}/css/tools/roles.css"
	}
});

Q.Tool.onActivate('id:Users_status').set(function () {
	this.state.onInvoke.set(function () {
		Q.handle(Q.urls['Communities/me']);
	}, 'Communities');
}, 'Communities');

Users.Device.beforeSubscribeConfirm.set(function (options, granted, subscribed) {
	Q.Audio.speak(["Communities/content", ["speak", "subscriptions", "confirm"]]);
}, 'Communities');

// Listen for Streams/subscribed messages destined to current user
// and run device subscription to allow receive notifications
Q.Streams.onMessage('', 'Streams/subscribed')
.set(function (message) {
	// filter by recipient
	if (Q.getObject(["byUserId"], message) !== Users.loggedInUserId()) {
		return;
	}

	Communities.registerDevice();
}, "Communities");

// On user login check if he device registration requested.
// If yes, try to register device again (because it was unregistered when logged out).
// If no, do nothing (means user never was requested device registration).
Users.onLogin.set(function (user) {
	// Reset so a fresh login (or a different user) can onboard again.
	// startOnboarding sets this to prevent the double-push that happened when
	// onRequireComplete and onInviteResolved both fired it in sequence.
	if (!user) { // the user changed
		return;
	}

	// if permissions already requested
	if (Q.getObject(['subject'], Q.Cache.session('Users.Permissions.notifications').get(user.id)) === true) {
		Communities.registerDevice();
	}

	_updateSlots(Q.info.slotNames);

}, "Communities");

Users.onLoginLost.set(function (user) {
	var url = location.href.split('#')[0].split('?')[0];
	if (Q.Users.requireLogin[url] || _updateSlots.updating === url) {
		url = Q.baseUrl(); // avoid fetching it over and over in a loop
	}
	_updateSlots(Q.info.slotNames, url);
	setTimeout(function () {
		
	}, 50);
}, "Communities");

function _updateSlots(slotNames, url, onActivate) {
	if (!Q.isEmpty(Q.loadUrl.loading)) {
		return;
	}
	_updateSlots.updating = url;
	url = url || location.href.split('#')[0].split('?')[0];
	Q.loadUrl(url, {
		slotNames: slotNames,
		loadExtras: 'all',
		ignoreDialogs: true,
		ignorePage: false,
		ignoreHistory: true,
		quiet: true,
		onLoadEnd: function () {
			_updateSlots.updating = null;
		},
		onActivate: onActivate
	});
}

var co = {
	scrollbarsAutoHide: false,
	handlers: {
		events: "{{Communities}}/js/columns/events.js",
		event: "{{Communities}}/js/columns/event.js",
		availabilities: "{{Communities}}/js/columns/availabilities.js",
		me: "{{Communities}}/js/columns/me.js",
		connect: "{{Communities}}/js/columns/connect.js",
		conversations: "{{Communities}}/js/columns/conversations.js",
		conversation: "{{Communities}}/js/columns/conversation.js",
		newConversation: "{{Communities}}/js/columns/newConversation.js",
		people: "{{Communities}}/js/columns/people.js",
		community: "{{Communities}}/js/columns/community.js",
		communities: "{{Communities}}/js/columns/communities.js",
		profile: "{{Communities}}/js/columns/profile.js",
		trip: "{{Communities}}/js/columns/trip.js",
		assetshistory: "{{Communities}}/js/columns/assetshistory.js",
		welcome: "{{Communities}}/js/columns/welcome.js",
		NFTprofile: "{{Communities}}/js/columns/NFTprofile.js",
		NFTowned: "{{Communities}}/js/columns/NFTowned.js",
		NFT: "{{Communities}}/js/columns/NFT.js",
		NFTcollections: "{{Communities}}/js/columns/NFTcollections.js"
	},
	dontUpdateThemeColor: true
};
if (Q.info.isMobile) {
	co.back = {src: "Q/plugins/Q/img/x.png"};
}
Q.Tool.define.options('Q/columns', co);

Q.onInit.set(function () {
	// After scriptData has merged Communities.onboarding.serverOptions
	// (steps, icon, …). Must not live under Streams/subscribed — that
	// left the tool with steps:[] and threw on construct.
	Q.Tool.define.options('Communities/onboarding',
		Q.getObject(['onboarding', 'serverOptions'], Communities));

	Users.login.options.onboardingUrl = Q.url('onboarding');
	Streams.invite.options.addLabel = true;
	Streams.invite.options.addMyLabel = true;

	Q.Text.get('Communities/content', function (err, text) {
		if (!text) {
			return;
		}
		Q.extend(Q.text.Communities, 10, text);
	});

	if (Communities.skipScrolling) {
		document.scrollingElement.scrollLeft = 0;
		document.scrollingElement.scrollTop = 0;
	}

	var lazyload = Q.getObject('Q.images.lazyload');
	if (lazyload) {
		// images would be added with data-lazyload-src instead of src attribute
		Q.activate(Q.Tool.prepare(
			document.body, 'Q/lazyload', Q.isPlainObject(lazyload) ? lazyload : {
				observerOptions: {
					root: null,
					rootMargin: '1000px'
				}
			}, 'Q_lazyload'
		));
	}

	Q.Tool.define.options("Calendars/event", {
		show: {
			promote: !Q.isEmpty(Communities.canPromote())
		}
	});

	if (Q.getObject("Q.Communities.browsertabs.startup") && !Users.loggedInUserId()) {
		Communities.login();
	}

	Q.Pointer.startCancelingClicksOnScroll(); // on all scrolls

}, 'Communities');

var clo = {
	press: {
		size: 1.1
	},
	release: {
		size: 1.5
	},
	onPress: {
		Communities: function (event, triggers) {
			this.parents().nextAll('.Communities_badge')
				.removeClass('Communities_show');
		}
	},
	shadow: null
};
if (!Q.info.isTouchscreen) {
	clo.press = {size: 0.92};
	clo.release = {size: 1.5, opacity: 0.5};
	clo.shadow = {opacity: 0.25, dip: 0.5};
}
Q.Tool.jQuery.options("Q/clickable", clo);
Q.Tool.define.options("Q/tabs", {
	loaderOptions: {
		quiet: true
	}
});

Q.Page.beforeUnload('').set(function () {
	// code to execute before page starts unloading
	if (Communities.$style) {
		Communities.$style.remove();
	}
}, 'Communities');

Q.Dialogs.push.options.mask = true;
Q.Tool.jQuery.options('Q/dialog', {
	mask: true,
	htmlClass: 'Communities_dialog',
	fadeTime: 1000,
	onLoad: function () {
		$(this).find('.Q_close').addClass('Communities_clickable_effect');
	}
});

function _handleScroll(tool) {
	if (!tool) {
		return;
	}
	$(tool.element).find('.Q_overflow')
		.off('scroll.Communities_handleScroll')
		.on('scroll.Communities_handleScroll', function () {
			var $this = $(this);
			$this.closest('.Q_columns_column')[0].setClassIf(
				$this.scrollTop() >= this.scrollHeight - this.clientHeight,
				'Communities_scrolledToBottom'
			);
		});
}

function _handleHints(tool) {
	if (!tool) {
		return;
	}
	var $filterInterests = tool.$('Q.controls_trigger Communities_filter_interests')
	if ($filterInterests.length) {
		Users.hint('Communities_filter_interests', $filterInterests, {
			show: {
				delay: 1000
			}
		});
	}
}

Q.Template.set(
	'Communities/promote/dialog',
	'<div class="Communities_promote_prompt">{{event.promote.Prompt}}</div>'
	+ '{{#each communityIds}}'
	+  '<div class="Communities_promote_button" data-communityid="{{this}}">'
	+   '{{{tool "Users/avatar" userId=this icon=true}}}'
	+  '</div>'
	+ '{{/each}}',
	{ text: 'Communities/content' }
);

Communities.hints.info = {
	'{{Communities}}/audio/event/': {
		'en.m4a': { delay: 9000 }
	}
};

Q.Pointer.activateTouchlabels(document.body);

// if stream loaded by URL, highlight preview tool
function _highlightLoadedStream () {
	if (Q.typeOf(this) !== 'Q.Tool') {
		return;
	}

	var publisherId = Q.getObject("state.publisherId", this) || Q.getObject("preview.state.publisherId", this);
	var streamName = Q.getObject("state.streamName", this) || Q.getObject("preview.state.streamName", this);

	if (!publisherId || !streamName) {
		return console.warn("_highlightLoadedStream: publisherId or streamName empty!");
	}

	var lastPart = streamName.split(/\//).pop();
	var $toolElement = $(this.element);

	if (window.location.href.indexOf(publisherId) > 0 && window.location.href.indexOf(lastPart) > 0) {
		$toolElement.addClass("Communities_stream_visited");
	}

	// on click some preview tool, switch Communities_stream_visited class
	$toolElement.on(Q.Pointer.fastclick, function () {
		$(".Communities_stream_visited").removeClass("Communities_stream_visited");
		$(this).addClass("Communities_stream_visited");
	});
}
Q.extend(Q.Tool.jQuery.loadAtStart, [
	'Q/clickfocus',
	'Q/contextual',
	'Q/scrollIndicators',
	'Q/iScroll',
	'Q/scroller'
]);
Q.Tool.onActivate('Websites/webpage/preview').add(_highlightLoadedStream, 'Communities_stream_visited');
Q.Tool.onActivate('Calendars/event/preview').add(_highlightLoadedStream, 'Communities_stream_visited');
Q.Tool.onActivate('Streams/chat/preview').add(_highlightLoadedStream, 'Communities_stream_visited');
Q.Tool.onActivate('Travel/trip/preview').add(_highlightLoadedStream, 'Communities_stream_visited');
})(Q, Q.jQuery);