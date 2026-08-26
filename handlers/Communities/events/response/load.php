<?php

function Communities_events_response_load()
{
	$experienceId = Q::ifset($_REQUEST, 'experienceId', 'main');
	$communityId = Q::ifset($_REQUEST, 'communityId', Users::currentCommunityId(true));
	list($fromTime, $toTime) = Communities::defaultEventTimes();
	$fromTime = Q::ifset($_REQUEST, 'fromTime', $fromTime);
	$toTime = Q::ifset($_REQUEST, 'toTime', $toTime);
	$offset = Q::ifset($_REQUEST, 'offset', 0);
	$limit = Q::ifset($_REQUEST, 'limit', Q_Config::get('Communities', 'pageSizes', 'events', 10));

	$allRelations = Communities::events(@compact("experienceId", "fromTime", "toTime", "communityId", "offset", "limit"));
	$relations = Streams_RelatedTo::filter($allRelations, array('readLevel' => 'fields'));

	// Same policy as the first page: the config key wins where it is set, and the
	// publisher-type heuristic is only the fallback for when it is unset. Without
	// this, "load more" hides person-published events with no participants that
	// the first page (Communities/events/response/column.php) showed.
	$configured = Q_Config::get('Calendars', 'event', 'hideIfNoParticipants', null);

	$res = array();
	foreach ($relations as $relation) {
		$hideIfNoParticipants = is_null($configured)
			? !Users::isCommunityId($relation->fromPublisherId)
			: $configured;
		$res[] = Q::tool(array(
			"Streams/preview" => array(
				'publisherId' => $relation->fromPublisherId,
				'streamName' => $relation->fromStreamName,
				'closeable' => false
			),
			"Calendars/event/preview" => array(
				'hideIfNoParticipants' => $hideIfNoParticipants
			)
		), Q_Utils::normalize($relation->fromPublisherId . ' ' . $relation->fromStreamName));
	}

	Q_Response::setScriptData('Q.Communities.events.loadedCount', $offset + $limit);

	return $res;
}

