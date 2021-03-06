# Template helper functions
from ckan.lib.helpers import dict_list_reduce
from ckan.plugins import toolkit

from harvest_helpers import update_frequencies, themes

def dict_list_or_dict_reduce(list_, key, unique=True):
    """
    Hack to make helpers.dict_list_reduce work also if provided a dict of dicts instead of a list of dicts
    """
    if isinstance(list_, dict):
        list_ = list_.values()
    res = dict_list_reduce(list_, key, unique)
    return res


def list_data_formats(package):
    """
    Improved list of available formats.
    By default, CSW harvester has a poor file format guessing algo
    (see  ckan/src/ckanext-spatial/ckanext/spatial/harvesters/base.py L94)
    This also checks on the data-format iso values
    :param package:
    :return:
    """
    # get first the formats inferred by default:
    formats = dict_list_or_dict_reduce(package['resources'], 'format')
    # then get the data-format values
    # The 3 following lines deal with root page where, strangely, objects that should be lists are provided as dicts
    extras = package.get('extras', [])
    if isinstance(extras, dict):
        extras = extras.values()
    data_formats = filter(lambda x: x['key'] == 'data-format', extras)
    data_formats = data_formats[0]['value'] if len(data_formats) > 0 else ''
    formats.extend(data_formats.split(','))
    # strip whitespaces around words and remove empty tags
    formats = [x.strip() for x in formats if x]
    #formats = [x for x in formats if x]
    # deduplicate list of values
    formats = list(set(formats))
    # sort alphabetically
    return sorted(formats)


def update_frequency_etalab_codelist(field):
    """
    Provides a choices list of update frequency values, matching the Etalab codelist (subset that has a match also in
    ISO 19139 codelist
    Used in scheming config ckan_dataset.json.
    :return:
    """
    # create a list of value/label entries to be used in the combobox in the dataset form
    return ({ 'value': x['eta_code'], 'label': x['label_fr'] } for x in update_frequencies)


def thematics():
    """
        :return: List of all thematics (groups)
        """
    # create a list of groups (thematics)
    try:

        user = toolkit.get_action('get_site_user')({'ignore_auth': True}, {})
        context = {'user': user['name']}
        groups = toolkit.get_action('group_list')(context, {'all_fields': True })
        return groups
    except:
        print("Error retrieving groups list")
        return list()


def thematics_list_kv(field):
    """
        Provides a choices list of thematics (groups) values
        Used in scheming config ckan_dataset.json.
        :return:
        """
    # create a list of value/label entries to be used in the multiselect field in the dataset form
    groups = thematics()
    return ({'value': x['name'], 'label': x['display_name']} for x in groups)


def ows_to_geoview_url(resource):
    """
    Tries to produce a suitable URL pattern as used by geoview plugin, from more common OWS URL
    see https://github.com/ckan/ckanext-geoview#openlayers-viewer
    :param url:
    :return: string [url]#[layername]
    """
    url = resource.get('url', '')
    # Append layername if it seems suitable

    format = resource.get('format', '') or ''
    name_might_be_layername = resource['name'] and ' ' not in resource['name']
    if url \
            and name_might_be_layername \
            and format.lower() in ['wms', 'wfs']:
        url = url + '#' + resource['name']
    return url


def is_geo_service(resource):
    f = resource.get('format', '') or ''
    if f.lower() in ['wms', 'wfs', 'wcs', 'geojson']:
        return True
    return False


def get_helpers():
    '''Register the functions above as a template helper functions.

    '''
    # Template helper function names should begin with the name of the
    # extension they belong to, to avoid clashing with functions from
    # other extensions.
    return {
        'theme_dict_list_or_dict_reduce': dict_list_or_dict_reduce,
        'theme_list_data_formats': list_data_formats,
        'theme_update_frequency_etalab_codelist' : update_frequency_etalab_codelist,
        'theme_thematics_list_kv' : thematics_list_kv,
        'theme_thematics' : thematics,
        'theme_ows_to_geoview_url': ows_to_geoview_url,
        'theme_is_geo_service': is_geo_service
    }