import PropTypes from 'prop-types';

export const NoticePollOptionType = PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    image_url: PropTypes.string,
    imageFile: PropTypes.instanceOf(File),
    previewUrl: PropTypes.string
});

export const NoticeType = PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    title: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    category: PropTypes.string.isRequired,
    created_at: PropTypes.string,
    is_recruiting: PropTypes.bool,
    is_sticky: PropTypes.bool,
    send_push: PropTypes.bool,
    recruitment_deadline: PropTypes.string,
    max_capacity: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    program_date: PropTypes.string,
    program_time: PropTypes.string,
    program_duration: PropTypes.string,
    program_location: PropTypes.string,
    program_type: PropTypes.string,
    is_leader_only: PropTypes.bool,
    target_regions: PropTypes.arrayOf(PropTypes.string),
    is_poll: PropTypes.bool,
    allow_multiple_votes: PropTypes.bool,
    poll_deadline: PropTypes.string,
    poll_options: PropTypes.arrayOf(NoticePollOptionType),
    images: PropTypes.arrayOf(PropTypes.string),
    image_url: PropTypes.string
});

export const NoticeStatsItemType = PropTypes.shape({
    JOIN: PropTypes.number,
    DECLINE: PropTypes.number,
    UNDECIDED: PropTypes.number,
    WAITLIST: PropTypes.number,
    attendedCount: PropTypes.number,
    is_recruiting: PropTypes.bool,
    is_poll: PropTypes.bool,
    voters: PropTypes.instanceOf(Set),
    pollTotal: PropTypes.number
});

export const ParticipantUserType = PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    school: PropTypes.string,
    phone_back4: PropTypes.string,
    profile_image_url: PropTypes.string,
    is_attended: PropTypes.bool
});

export const ParticipantListType = PropTypes.shape({
    JOIN: PropTypes.arrayOf(ParticipantUserType),
    DECLINE: PropTypes.arrayOf(ParticipantUserType),
    UNDECIDED: PropTypes.arrayOf(ParticipantUserType),
    WAITLIST: PropTypes.arrayOf(ParticipantUserType)
});

export const UserType = PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    school: PropTypes.string,
    phone_back4: PropTypes.string,
    profile_image_url: PropTypes.string
});
