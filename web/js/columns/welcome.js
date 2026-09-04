"use strict";
(function(Q, $, undefined) {

	Q.onInit.add(function () {
		Q.addStylesheet('{{Communities}}/css/columns/welcome.css', {slotName: 'Communities'});
	});

	Q.exports(function (options, index, column, data) {
		$(".Q_button.getStarted", column).on(Q.Pointer.fastclick, function () {
			Q.Users.login({
				onSuccess: function () {
					Q.handle(Q.url("{{baseUrl}}/home"))
				}
			});
		});
	});

})(Q, Q.jQuery);