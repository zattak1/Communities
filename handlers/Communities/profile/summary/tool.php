<?php
	
function Communities_profile_summary_tool($params)
{
	Q_Valid::requireFields(array('publisherId'), $params);
	// The viewer is always the logged-in user. A tool option is not a trusted
	// source for the identity to read as: an "asUserId" option here let the
	// caller choose whose access the reads below were evaluated with.
	$user = Users::loggedInUser();
	$asUserId = $user ? $user->id : '';
	$publisherId = $params['publisherId'];
	// Streams_Stream::fetch() returns a stream whatever its readLevel, content
	// and attributes included; only testReadLevel() applies the readLevel.
	// Without these checks the tool rendered another person's birthday,
	// gender, height, links and location to anyone, logged out included.
	$readable = function ($stream, $level = 'content') {
		return ($stream and $stream->testReadLevel($level)) ? $stream : null;
	};
	$birthdayStream = $readable(Streams_Stream::fetch($asUserId, $publisherId, 'Streams/date/birthday'));
	$genderStream = $readable(Streams_Stream::fetch($asUserId, $publisherId, 'Streams/user/gender'));
	$heightStream = $readable(Streams_Stream::fetch($asUserId, $publisherId, 'Streams/user/height'));
	// Coordinates are attributes, which need 'fields', not just 'content'.
	$locationStream = $readable(Streams_Stream::fetch($asUserId, $publisherId, 'Places/user/location'), 'fields');
	$userLocationStream = $asUserId
		? Streams_Stream::fetch($asUserId, $asUserId, 'Places/user/location')
		: null;

	// return "24 year old man, 6'3";
	$parts = array();
	$result = "";

	$fbStream = $readable(Streams_Stream::fetch($asUserId, $publisherId, 'Streams/url/facebook'));
	if ($fbStream && !empty($fbStream->content)) {
		$result .= '<a target="_blank" href="'.$fbStream->content.'" class="Communities_summary_social" data-type="facebook"></a>';
	}

	$twitterStream = $readable(Streams_Stream::fetch($asUserId, $publisherId, 'Streams/url/twitter'));
	if ($twitterStream && !empty($twitterStream->content)) {
		$result .= '<a target="_blank" href="'.$twitterStream->content.'" class="Communities_summary_social" data-type="twitter"></a>';
	}

	$linkedinStream = $readable(Streams_Stream::fetch($asUserId, $publisherId, 'Streams/url/linkedin'));
	if ($linkedinStream && !empty($linkedinStream->content)) {
		$result .= '<a target="_blank" href="'.$linkedinStream->content.'" class="Communities_summary_social" data-type="linkedin"></a>';
	}

	if ($birthdayStream) {
		$now = time();
		$age = 0;
		$temp = strtotime($birthdayStream->content);
		while ($now > ($temp = strtotime('+1 year', $temp))) {
			++$age;
		}
		$parts[] = $genderStream ? $age : "$age years old";
	}
	if ($genderStream) {
		$parts[] = Q_Utils::ucfirst($genderStream->content);
	}
	if ($heightStream) {
		$heights = array();
		for ($in = 12*4+6; $in <= 12*8; ++$in) {
			$cm = floor($in * 2.54);
			$feet = floor($in / 12);
			$inches = $in % 12;
			$heights[$cm] = "$feet'$inches\"";
		}
		$parts[] = Q::ifset($heights, $heightStream->content, null);
	}
	$result .= implode(', ', $parts);
	if ($locationStream) {
		$placeName = $locationStream->getAttribute('placeName');
		$state = $locationStream->getAttribute('state');
		$separator = ($placeName and $state) ? ', ' : '';
		$placeString = $placeName . $separator . $state;
		$result .= "<div class='Communities_summary_place'>" . ($placeString ? $placeString : '') . "</div>";
		if ($userLocationStream) {
			$distance = Places::distance(
				$userLocationStream->getAttribute('latitude'),
				$userLocationStream->getAttribute('longitude'),		
				$locationStream->getAttribute('latitude'),
				$locationStream->getAttribute('longitude')
			);
			if (isset($distance)) {
				$km = ceil($distance / 1000);
				// $s = ($distance != 1) ? 's' : '';
				$result .= "<div class='Communities_summary_distance'>($km km away)</div>";
			}
		}
	}

	return $result;
}