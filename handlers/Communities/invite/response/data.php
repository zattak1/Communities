<?php

/**
 * Fills the "data" slot for Communities/invite, from the result that
 * Communities_invite_post() left in Streams::$cache['invited'].
 *
 * This used to be `return Q::event('Streams/invite/response/data')`, which
 * could never work: there is no handlers/Streams/invite/response/data.php
 * anywhere in the tree, and there never was. Streams/invite does not need one
 * because Streams_invite_post() fills its own slots with
 * Q_Response::setSlot(). Communities_invite_post() does not, so every request
 * to Communities/invite died with "missing file
 * handlers/Streams/invite/response/data.php" — and Q.Streams.invite(), the
 * only client that posts here, always asks for the "data" slot. See
 * https://github.com/zattak1/ro/issues/478
 *
 * The shaping below is deliberately identical to Streams_invite_post()'s, so
 * a client cannot tell the two endpoints' "data" slots apart.
 */
function Communities_invite_response_data()
{
	$data = Q::ifset(Streams::$cache, 'invited', array());
	if (!empty($data['invite'])) {
		$data['url'] = $data['invite']->url();
		$data['invite'] = $data['invite']->exportArray();
	}

	// do not give the clients an easy way to find userIds by identifiers and xids
	unset($data['userIds']);
	unset($data['alreadyParticipating']);

	return $data;
}
