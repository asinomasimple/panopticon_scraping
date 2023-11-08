const { database } = require('../config/config');
const mysql = require('mysql2/promise');

/**
 * Creates the database connection
 */
async function createDbConnection() {
    const connection = await mysql.createConnection(database);
    return connection;
}
/**
 * Adds object data into 'topics' table in database
 * 
 * @param {array} data Data objects with the records to insert in the db
 * @returns {Promise} A Promise that resolves when the insertion is complete or rejects on error.
 */
async function addTopicsToDb(data) {
    return new Promise(async (resolve, reject) => {
      const connection = await createDbConnection();
  
      try {
          await connection.beginTransaction();
  
          for (const d of data) {
              const topicsInsertSql = 'INSERT INTO topics (id, status, title, date, post, user, topic_type) VALUES (?, ?, ?, ?, ?, ?, ?)';
              const topicsValues = [d.id, d.status, d.title, d.date, d.post, d.user, d.topicType];
              await connection.execute(topicsInsertSql, topicsValues);
  
              if (d.topicType === 'nt') {
                  const ntInsertSql = 'INSERT INTO nt (topic_id, url, thumbnail) VALUES (?, ?, ?)';
                  const ntValues = [d.id, d.ntUrl, d.ntThumbnail];
                  await connection.execute(ntInsertSql, ntValues);
              }
  
              if (d.topicType === 'profile') {
                  const profile = d.profile;
                  if (profile.rip != "") {
                      const profileInsertSql = 'INSERT INTO profiles (topic_id, rip) VALUES (?, ?)';
                      const profileValues = [d.id, profile.rip];
                      await connection.execute(profileInsertSql, profileValues);
                  } else {
                      const profileInsertSql = 'INSERT INTO profiles (topic_id, name, location, url, avatar, uncertified, endorsement_status, endorsed_by, bio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
                      const uncertified = d.undertified == "uncertified";
                      const profileValues = [d.id, profile.name, profile.location, profile.url, profile.avatar, profile.uncertified, profile.endorsementStatus, profile.endorsedBy, profile.bio];
                      await connection.execute(profileInsertSql, profileValues);
                  }
              }
          }
  
          await connection.commit();
          console.log('Data inserted successfully.');
          resolve('Data inserted successfully.');
      } catch (error) {
          await connection.rollback();
          console.error('Error', error);
          reject(error);
      } finally {
          connection.close();
      }
    });
  }
/**
 * Checks 'topics' database table for last id
 */
async function getLastTopicId() {
    const connection = await createDbConnection();

    try {
        // Query to retrieve the maximum ID from the 'topics' table
        const query = 'SELECT MAX(id) AS lastId FROM topics';
        const [rows] = await connection.execute(query);

        if (rows.length > 0) {
            const lastId = rows[0].lastId;
            return lastId;

        } else {
            console.log('No data in the topics table.');
            return null;
        }
    } catch (error) {
        console.error('Error:', error);
        throw new Error(error);
    } finally {
        connection.close();
    }
}


/**
 * Recursively checks an object for `undefined` values and returns the name of the first key
 * with an `undefined` value.
 *
 * @param {object} obj - The object to check.
 * @param {string} [parentKey] - Internal use for recursion; you don't need to provide this.
 * @returns {string|null} - The name of the first key with an `undefined` value, or `null` if none found.
 */
function findUndefinedKey(obj, parentKey) {
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];

            if (value === undefined) {
                return parentKey ? `${parentKey}.${key}` : key;
            } else if (typeof value === 'object' && !Array.isArray(value)) {
                const nestedKey = findUndefinedKey(value, parentKey ? `${parentKey}.${key}` : key);
                if (nestedKey !== null) {
                    return nestedKey;
                }
            }
        }
    }

    return null;
}


module.exports = { getLastTopicId, addTopicsToDb };