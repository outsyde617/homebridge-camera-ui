'use strict';

const Logger = require('../../src/helper/logger.js');
const packageFile = require('../../package.json');  

const express = require('express');
const router = express.Router();
const passport = require('passport');

const socket = require('../server/socket');

module.exports = (app, db_settings, autoSignout) => {
  
  router.get('/', async (req, res, next) => { // eslint-disable-line no-unused-vars
  
    if(req.session.user)
      delete req.session.user;
  
    res.render('login', {
      title: 'Login',
      version: packageFile.version,
      flash: req.flash()
    });
    
  });
  
  router.post('/', async (req, res, next) => { // eslint-disable-line no-unused-vars
    
    passport.authenticate('local', (err, user, info) => {
    
      if (err) {
      
        Logger.ui.error('An error occured during login process!');
        Logger.ui.error(err.message);
        
        req.flash('error', err.message);
        return res.status(500).send({
          message: err.message
        });
        
      }
    
      if (!user) {
      
        info.message = res.locals.t('views.login.incorrect_cr');
        req.flash('error', info.message);
        return res.status(401).send(info);
        
      }
      
      if(user && user.role === 'Master' && info.change){
        Logger.ui.warn('Credentials not changed! Please change your credentials!');
        req.session.user = user;
        return res.status(201).send({
          photo: user.photo + '?r=' + Math.random(),
          username: user.username, 
          role: user.role
        });
      }
      
      req.login(user, (err) => {
      
        if (err){
          
          Logger.ui.error('An error occured during login process!');
          Logger.ui.error(err.message);
          
          req.flash('error', err.message);
          return res.status(500).send({
            message: err.message
          });
          
        }
        
        let profile = db_settings.getProfile();
        
        let sessionTimer = isNaN(parseInt(profile.logoutTimer)) ? false : parseInt(profile.logoutTimer) * 60 * 60 * 1000;

        Logger.ui.info('Successfully logged in!', user.username);
        
        req.session.noAuth = false;
        req.session.userID = user.id;          
        req.session.username = user.username;
        req.session.role = user.role;
        req.session.photo = user.photo + '?r=' + Math.random();
        
        socket.io('login', user);
         
        if(sessionTimer){
          
          Logger.ui.debug('Your session expires in ' + profile.logoutTimer + ' hour(s)', user.username);

          req.session.cookie.maxAge = sessionTimer;
          
          if(autoSignout[user.username])
            clearTimeout(autoSignout[user.username]);
          
          autoSignout[user.username] = setTimeout(() => {
            
            Logger.ui.info('Session timed out.', user.username);
            
            delete req.session.noAuth;
            delete req.session.userID;
            delete req.session.username;
            delete req.session.role;
            delete req.session.photo;
            
            socket.io('logout_user', user.username);                                               
          
          }, sessionTimer + 30000);
        
        } else {
        
          Logger.ui.debug('Your session will not expire!', user.username);
        
          req.session.cookie.maxAge = 2147483648 * 1000;
        
        }
        
        req.session.save(() => {
        
          res.status(200).send({
            photo: user.photo + '?r=' + Math.random(),
            username: user.username, 
            role: user.role
          });
        
        });
        
      });
      
    })(req, res, next);

  });
  
  return router;

};