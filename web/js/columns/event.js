"use strict";
(function(Q, $, undefined) {
	
var Streams = Q.Streams;
var Communities = Q.Communities;
var Calendars = Q.Calendars;
var Places = Q.Places;

Q.exports(function (options, index, div, data) {
	var text;
	var $column = $(div);
	var columnTool = Q.Tool.from($column.closest(".Q_tool.Q_columns_tool"), "Q/columns");
	var userId = Q.Users.loggedInUserId();

	Q.addStylesheet('{{Communities}}/css/columns/event.css', { slotName: 'Communities' });

	var pipe = new Q.Pipe(['event', 'text'], function () {
		var state = eventTool.state;
		var $titleSlot = $(".Q_title_slot", $column);

		$titleSlot.plugin('Q/textfill', {
			maxFontPixels: 25,
			minFontPixels: 16,
			fillPadding: true
		});
		state.onTitleChanged.set(function(newTitle){
			$titleSlot.html(newTitle);
			$titleSlot.plugin('Q/textfill', "refresh");
		});

		var p = new Q.Pipe(['chat', 'going'], function (params, subjects, key) {
			var chat = subjects.chat;
			var going = params.going[0];
			if (going === 'no') {
				chat.prevent(text.event.JoinEventToChat);
			} else {
				chat.prevent(false);
			}
		});
		eventTool.forEachChild('Streams/chat', function () {
			this.state.onRefresh.set(p.fill('chat'), eventTool);
		});
		eventTool.state.onRefresh.set(function () {
			var participants = eventTool.child('Streams_participants');
			if (participants) {
				participants.state.onInvited.set(function (err) {
					Communities.hints('invitedSomeone', [$column]);
				});
			}
		}, 'Communities/event/column');
		eventTool.state.onGoing.set(function (g, stream) {
			if (g !== 'no') {
				// Calendars.Event.addToCalendar(publisherId, eventId);
				Communities.hints('goingYes', [$column]);
				$column.addClass('Communities_event_reserved');
			} else {
				// Calendars.Event.removeFromCalendar(publisherId, eventId);
				Communities.hints('goingNo', [$column]);
				$column.removeClass('Communities_event_reserved');
			}
			p.fill('going')(g);
		}, 'Communities/event/column');

		setTimeout(function () {
			Q.Pointer.hint($("button[name=reservation]", div)[0], {
				show: { delay: 0 },
				dontStopBeforeShown: true
			});
		}, 5000);

		var publisherId = eventTool.state.publisherId;
		var streamName = eventTool.state.streamName;
		var eventId = eventTool.state.streamName.split('/').pop();
		var paymentType = Q.getObject("type", eventStream.getAttribute('payment'));

		state.onInvoke('presentation').set(Communities.pushPresentationColumn, 'Communities/event/column');
		state.onInvoke('chat').set(Communities.pushChatColumn, 'Communities/event/column');
		state.onInvoke('promote').set(Communities.promoteEvent, 'Communities/event/column');
		state.onInvoke('close').set(Communities.eventClose, 'Communities/event/column');

		state.onInvoke('moreInfo').set(function (stream) {
			Q.openUrl(stream.getAttribute("eventUrl"));
		}, 'Communities/event/column');
		state.onInvoke('registration').set(function (stream) {
			Q.openUrl(stream.getAttribute("ticketsUrl"));
		}, 'Communities/event/column');
		state.onInvoke('livestream').set(function (stream) {
			var eventTool = this;
			var url = stream.getAttribute("livestream");

			// if not a valid URL - exit
			if (!url.matchTypes('url').length) {
				return;
			}

			eventTool.getGoing(userId, function (going) {
				if (going !== 'yes') {
					return;
				}

				if (!url.startsWith("http")) {
					url = 'http://' + url;
				}

				Q.openUrl(url);
			});
		}, 'Communities/event/column');

		var _openUrl = function (url) {
			var browsertab = Q.getObject("cordova.plugins.browsertab");
			if (browsertab) {
				browsertab.openUrl(url);
			} else {
				window.open(url);
			}
		};
		state.onInvoke('moreInfo').set(function (stream) {
			_openUrl(stream.getAttribute("eventUrl"));
		}, 'Communities');
		state.onInvoke('registration').set(function (stream) {
			_openUrl(stream.getAttribute("ticketsUrl"));
		}, 'Communities');

		state.onInvoke('local').set(function (stream) {
			var location = Places.Location.fromStream(stream);
			var latitude = location.latitude;
			var longitude = location.longitude;
			var q = location.venue;
			var addr = location.address;
			Q.confirm(text.event.WhichMaps, function (val) {
				var url;

				if (val === null) {
					return;
				}

				if (val === true) {
					url = 'https://maps.google.com?saddr=Current+Location';
				} else if (val === false) {
					url = 'https://maps.apple.com/?dirflg=d';
					if (latitude && longitude) {
						url += '&sll=' + latitude + ',' + longitude;
					}
				}
				url += '&q' + encodeURIComponent(q);
				url += '&daddr=' + encodeURIComponent(addr);
				Q.openUrl(url);
			}, {
				title: text.event.GetDirections,
				ok: 'Google',
				cancel: 'Apple',
				noClose: false
			});
		}, 'Communities/event/column');

		state.onInvoke('chat').set(Communities.pushChatColumn, 'Communities/event/column');

		state.onInvoke('time').set(function (stream) {
			Calendars.Event.addToCalendar(publisherId, eventId);
		}, 'Communities/event/column');

		setTimeout(Communities.getChatMessages(publisherId, streamName), 300);

		state.onInvoke('myqr').set(function () {
			var text = this.text;
			var size = 250;
			var myqrInterval;

			Q.Dialogs.push({
				title: text.event.tool.Myqr,
				className: "Communities_event_myqr",
				content: $("<div />").addClass("Communities_loading").height(size),
				onActivate: function (dialog) {
					myqrInterval = setInterval(function () {

						if (!state.userInviteUrl) {
							return;
						}

						clearInterval(myqrInterval);

						var $content = $(".Q_dialog_content", dialog);
						paymentType && $content.attr("data-paymentType", paymentType);
						$content.attr("data-going", $(eventTool.element).attr("data-going"));

						var pipe = new Q.pipe(["paid", "qrIcon"], function (params, subject) {
							var paid = params.paid[0];
							var qrIcon = params.qrIcon[0];

							$content.html(qrIcon);
							var $qrCode = $(".Calendars_event_qrcode", $content);
							var qrCodePos = $qrCode.position();
							if (paymentType === 'required' && paid !== 'fully') {
								var $button = $("<button name='payToAttend' class='Q_button' type='button'>" + eventTool.text.event.tool.PayToAttend + "</button>")
									.on(Q.Pointer.fastclick, function () {
										var $this = $(this);
										$this.addClass("Q_working");
										eventTool.going("yes", function () {
											$this.removeClass("Q_working");
										}, {
											payToAttend: true
										});
									}
								);
								var $redCircle = $('<div class="Calendars_event_redCircle">').css({
										width:  $qrCode.outerWidth()  + 'px',
										height: $qrCode.outerHeight() + 'px',
										top: qrCodePos.top,
										left: qrCodePos.left
									})
								eventTool.state.onGoing.set(function (going) {
									if (going === 'yes') {
										$button.remove();
									}
									$content.attr("data-going", going);
								});
								$content.append($redCircle).append($button);
							}
						});

						if (paymentType === 'required') {
							Q.req('Calendars/event', ['paid'], function (err, response) {
								var r = response && response.errors;
								var msg = Q.firstErrorMessage(err, r);
								if (msg) {
									return;
								}

								pipe.fill("paid")(response.slots.paid);
							}, {
								fields: {
									publisherId,
									streamName,
									userId
								}
							});
						} else {
							pipe.fill("paid")(null);
						}

						Q.addScript("{{Q}}/js/qrcode/qrcode.js", function(){
							var $qrIcon = $("<div class='Calendars_event_qrcode'></div>");
							new QRCode($qrIcon[0], {
								text: state.userInviteUrl,
								width: size,
								height: size,
								colorDark : "#000000",
								colorLight : "#ffffff",
								correctLevel : QRCode.CorrectLevel.H
							});

							$content.html($qrIcon);

							pipe.fill("qrIcon")($qrIcon);
						});
					}, 500);
				},
				onClose: function () {
					clearInterval(myqrInterval);
				}
			});
		}, 'Communities/event/column');

		// request for additional event data to add classes and apply column control slot
		Q.req('Communities/event', 'data', function (err, data) {
			if (Q.firstErrorMessage(err, data && data.errors)) {
				return;
			}

			var data = data.slots.data;

			state.userInviteUrl = data.userInviteUrl;

			// Communities reservation behavior
			if (Q.getObject('Q.Communities.event.mode') === 'classic') {
				return;
			}

			Q.each(data.columnClass, function (index, value) {
				$column.addClass(value);
			});

			columnTool.setControls($column.attr('data-index'), data.controls);

			$('.Q_controls_slot button[name=reservation]', div).on(Q.Pointer.fastclick, function () {
				var $this = $(this);
				var _going = function () {
					$this.addClass("Q_working");
					eventTool.going('yes', function (success) {
						$this.removeClass('Q_working');
					}, {
						title: $this.text().trim()
					});
				};

				// possible to declare custom handler which process something, than process __
				var reservationPreprocess = Q.getObject('Q.Communities.event.reservationPreprocess');
				if (Q.typeOf(reservationPreprocess) === 'function') {
					Q.handle(reservationPreprocess, eventTool, [_going]);
				} else {
					_going();
				}

				return false;
			});

			$('.Q_controls_slot button[name=cancelReservation]', div).on(Q.Pointer.fastclick, function () {
				var $this = $(this);
				$this.addClass("Q_working");

				var _confirm = function (payed) {
					Q.confirm(payed ? text.events.YouWillRefunded : '', function (res) {
						if (!res) {
							$this.removeClass("Q_working");
							return;
						}

						eventTool.going('no', function (success) {
							$this.removeClass("Q_working");
						});
					}, {
						title: text.events.AreYouSure
					});
				};

				if (data.payable) {
					// request to know if user actually payed
					Q.req('Communities/event', 'data', function (err, data) {
						if (Q.firstErrorMessage(err, data && data.errors)) {
							return;
						}

						_confirm(!Q.isEmpty(data.slots.data.payment));
					}, {
						fields: {
							publisherId: state.publisherId,
							streamName: state.streamName
						}
					});
				} else {
					_confirm(false);
				}

				return false;
			});

			$('.Q_controls_slot button[name=updateReservation]', div).on(Q.Pointer.fastclick, function () {
				var $this = $(this);
				$this.addClass("Q_working");

				eventTool.addRelatedParticipants({
					callback: function (process) {
						$this.removeClass("Q_working");
					}
				});

				return false;
			});
		}, {
			fields: {
				publisherId: state.publisherId,
				streamName: state.streamName
			}
		});

		// if url contains 'startWebRTC', start chat column
		if (document.location.href.includes('startWebRTC')) {
			Communities.pushChatColumn(eventStream, eventTool.element);
		}
	});

	div.forEachTool('Travel/trips', function () {
		this.state.onInvoke && this.state.onInvoke.set(Communities.pushTripColumn, 'Communities/event/column');
	});

	var eventTool;
	var eventStream;
	div.forEachTool('Calendars/event', function () {
		eventTool = this;
		Streams.get(eventTool.state.publisherId, eventTool.state.streamName, function (err) {
			if (err) {
				return Q.error(Q.firstErrorMessage(err));
			}

			eventStream = this;
			pipe.fill('event')(eventTool);
		});

	});

	Q.Text.get('Communities/content', function (err, content) {
		text = content;
		pipe.fill('text')(text);
	}, 'Communities/event/column');

	div.forEachTool("Users/avatar", function () {
		var userId = this.state.userId;
		var $te = $(this.element);
		if (!$te.hasClass("Calendars_event_publisher")) {
			return;
		}

		// open profile onclick
		$te.on(Q.Pointer.fastclick, function () {
			if (Q.Users.isCommunityId(userId)) {
				Communities.openCommunityProfile.call(this, userId);
			} else {
				Communities.openUserProfile.call(this, userId);
			}
			return false;
		});

		// add social icons
		Q.each(['twitter', 'github', 'linkedin', 'instagram'], function (i, social) {
			if (Q.Users.isCommunityId(userId)) {
				return;
			}

			Q.Streams.get(userId, 'Streams/user/' + social, function (err) {
				if (err || !this.fields.content) {
					return;
				}

				$te.attr('data-socials', true);
				var userName = this.fields.content;
				var $userName = $(".Users_avatar_name", $te);

				$('<i class="Communities_social_icon" data-type="' + social + '" data-connected="' + userName + '"></i>')
				.on(Q.Pointer.fastclick, function () {
					const socialUrls = {
						"facebook": "https://www.facebook.com/",
						"twitter": "https://twitter.com/",
						"linkedin": "https://www.linkedin.com/in/",
						"github": "https://github.com/",
						"instagram": "https://www.instagram.com/"
					};
					var redirectUrl = userName.includes(socialUrls[social]) ? userName : socialUrls[social] + userName;
					Q.openUrl(redirectUrl);
				})
				.appendTo($userName);

				if ($userName.outerHeight() > $te.outerHeight()) {
					$te.outerHeight($userName.outerHeight());
				}
			});
		});
	}, "Communities/event/column");
});

})(Q, Q.jQuery);