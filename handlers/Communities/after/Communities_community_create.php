<?php

function Communities_after_Communities_community_create($params)
{
	$userId = Users::loggedInUser();
    $userId = Q::ifset($userId, "id", null);
    if (!$userId) {
        return;
    }

	$community = $params['community'];
	$skipAccess = $params['skipAccess'];
	$quota = $params['quota'];

	// if for some reason skippAccess or quota not exceeded
	if ($skipAccess || $quota instanceof Users_Quota) {
		return;
	}

	$amountToSpend = (int)Q_Config::expect('Assets', 'credits', 'spend', 'Communities/create');

	// The credits go to the app's main community, which provides communities.
	// spend() requires a receiver: without toPublisherId it threw
	// RequiredField, so creating a community past the quota always failed
	// after the community was made, and nothing was charged.
	Assets_Credits::spend(null, $amountToSpend, Assets::CREATED_COMMUNITY, $userId, array(
		'toPublisherId' => Users::communityId(),
		'communityId' => $community->id
	));
}