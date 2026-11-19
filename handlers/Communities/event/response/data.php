<?php
function Communities_event_response_data($params) {
	$streamName = Q::ifset($params, 'streamName', Communities::requestedId($params, 'streamName'));
	$publisherId = Q::ifset($params, 'publisherId', Communities::requestedId($params, 'publisherId'));
	$stream = Q::ifset($params, 'stream', Streams_Stream::fetch(null, $publisherId, $streamName));
	if (!$stream) {
		return array();
	}

	$user = Users::loggedInUser();
	$userId = Q::ifset($user, "id", null);

	$columnClass = array();
	$controls = null;
	$eventMode = Q_Config::get('Communities', 'event', 'mode', Q_Request::isMobile() ? "mobile" : "desktop", null);
	$eventEnded = $stream->getAttribute('endTime') < time();
	if (!$eventEnded && ($eventMode == 'reservation' || $eventMode == 'services')) {
		$controls = Q::view('Communities/controls/eventReservation.php');
		$columnClass[] = 'Communities_event_reservation';

		if (Q_Config::get("Assets","service", "relatedParticipants", null)) {
			$columnClass[] = 'Communities_event_relatedParticipants';
		}

		// A paid class the member asked for but hasn't paid for is going=maybe
		// with role "requested". Showing it as reserved left only "Cancel
		// Reservation" on screen, so a member whose payment didn't finish the
		// booking believed they were booked (ro#1245). Show "Make Reservation"
		// instead: it re-runs going=yes, which spends credits or asks to pay.
		// Upstream Qbix/Communities 7514faf splits this into its own
		// "requested" state with separate buttons.
		$results = Calendars_Event::getGoing($stream, null, true);
		$going = $results['going'];
		$eventPayment = $stream->getAttribute('payment');
		$paymentPending = $going === 'maybe'
			&& is_array($eventPayment) && Q::ifset($eventPayment, 'type', null) === 'required'
			&& !($results['participant']
				&& $results['participant']->getExtra('paid') === 'fully');
		if ($going !== 'no' && !$paymentPending) {
			$columnClass[] = 'Communities_event_reserved';
		}
	}

	$userInviteUrl = null;
	if ($userId) {
		// create invite url
		$eventId = explode('/', $streamName);
		$eventId = end($eventId);
		$url = Q_Uri::url("Communities/event publisherId=$publisherId eventId=$eventId");
		$userInviteUrl = Streams::userInviteUrl($userId, $url);

		// get info about payment
		if ($stream->getAttribute('payment')) {
			$payments = Assets_Credits::getPaymentsInfo($userId, $stream);
			if ($payments["conclusion"]["amount"]) {
				$payment = array('amount' => $payments["conclusion"]["amount"]);
			} else {
				$payment = null;
			}
		} else {
			$payment = null;
		}
	}

	$payable = $stream->getAttribute('payment');

	return @compact("columnClass", "controls", "userInviteUrl", "payable", "payment");
}