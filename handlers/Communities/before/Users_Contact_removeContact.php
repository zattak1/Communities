<?php

function Communities_before_Users_Contact_removeContact($params, &$result)
{
	$userId = $params['userId'];
	$label = $params['label'];
	$skipAccess = Q::ifset($params, 'skipAccess', false);

	if ($skipAccess) {
		$result = true;
		return;
	}
	
	$asUserId = Q::ifset($params, "asUserId", null) ?: Users::loggedInUser(true)->id;

	if (!Users::isCommunityId($userId)) {
		$result = true;
	}

	// skipAccess, because this read *computes* the authorization decision --
	// it is not a read on the caller's behalf. Its sibling
	// Users_Contact_addContact.php has always passed it; this one did not, and
	// only got away with it because Users_Contact::fetch skipped the check
	// whenever no label was given. That hole is closed (ro#552), so state the
	// intent here rather than depend on it.
	$contacts = Users_Contact::fetch($userId, null, array(
		'contactUserId' => $asUserId,
		'skipAccess' => true
	));
	foreach ($contacts as $contact) {
		if (Users_Label::canRevokeLabel($contact->label, $label, false)) {
			$result = true;
		}
	}
}